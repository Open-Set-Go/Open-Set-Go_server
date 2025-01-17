import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { load } from 'js-yaml';
import { readFileSync } from 'fs';
import { readdir } from 'fs/promises';
import axios from 'axios';

export type file = { path: string; content: string };

export type envTemplateType = {
  language: string;
  frameworks: { framework: string; path: string }[];
}[];

@Injectable()
export class FilesService {
  constructor() {}
  uploadFiles = async (
    GHtoken: string,
    userName: string,
    repoName: string,
    files: { path: string; content: string }[],
  ): Promise<number> => {
    const octokit = new Octokit({ auth: GHtoken });
    try {
      // get the branch data including current commit hash
      const { data: branchData } = await octokit.rest.repos.getBranch({
        owner: userName,
        repo: repoName,
        branch: 'main',
      });

      const baseTree = branchData.commit.commit.tree.sha;

      // add files into the tree
      const tree = await octokit.rest.git.createTree({
        owner: userName,
        repo: repoName,
        base_tree: baseTree,
        tree: files.map((file) => ({
          path: file.path,
          content: file.content,
          mode: '100644',
        })),
      });

      Logger.debug(`[${tree.status}] Tree has been created successfully`);

      // create a new commit
      const newCommit = await octokit.rest.git.createCommit({
        owner: userName,
        repo: repoName,
        message:
          'Initial commit \n\nCo-authored-by: Open-Set-Go_BOT <opensetgo.oss@gmail.com>',
        tree: tree.data.sha,
        parents: [branchData.commit.sha],
      });

      Logger.debug(
        `[${newCommit.status}] Commit has been created successfully`,
      );

      // update the branch
      const response = await octokit.rest.git.updateRef({
        owner: userName,
        repo: repoName,
        ref: 'heads/main',
        sha: newCommit.data.sha,
      });

      Logger.debug(`[${response.status}] Branch has been updated succesfully`);
      return response.status;
    } catch (error) {
      console.error('Error uploading files:', error);
      return 500;
    }
  };

  makeGitignore = async (
    ignoreList: string[],
    files: file[],
  ): Promise<file[]> => {
    const ignorestr = ignoreList.join();
    const GITIGNOREIO_URL =
      `https://www.toptal.com/developers/gitignore/api/` + ignorestr;
    const gitignoreContent: string = (await axios.get(GITIGNOREIO_URL)).data;
    const newFiles: file[] = await this.concatGitignore(
      gitignoreContent,
      files,
    );
    return newFiles;
  };

  concatGitignore = async (
    gitignoreContent: string,
    files: file[],
  ): Promise<file[]> => {
    const gitignoreIndex = files.findIndex(
      (file) => file.path === '.gitignore',
    );

    if (gitignoreIndex !== -1) {
      files[gitignoreIndex].content += gitignoreContent;
    } else {
      files.push({ path: '.gitignore', content: gitignoreContent });
    }

    return files;
  };

  getFileList = async (dirName: string) => {
    let files: string[] = [];
    const items = await readdir(dirName, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        files = [
          ...files,
          ...(await this.getFileList(`${dirName}/${item.name}`)),
        ];
      } else {
        files.push(`${dirName}/${item.name}`);
      }
    }

    return files;
  };

  makeFramework = async (
    language: string,
    framework: string,
  ): Promise<file[]> => {
    if (framework === null) {
      Logger.debug('err');
      return;
    }

    const supportedEnv = await this.getEnvTemplate();

    const filePath = supportedEnv
      .find((languages) => {
        return languages.language == language;
      })
      .frameworks.find((frameworks) => {
        return frameworks.framework == framework;
      }).path;

    const filePaths: string[] = (await this.getFileList(
      `./src/file/env-template${filePath}`,
    )) as string[];

    const files = filePaths.map((path) => {
      const content = readFileSync(path, 'utf-8');
      path = path.replace(`./src/file/env-template${filePath}/`, '');
      const file: file = { path, content };
      return file;
    });

    return files;
  };

  getEnvTemplate = async (): Promise<envTemplateType> => {
    const supportedEnv = (await load(
      readFileSync('./src/file/env-template/supportedEnv.yml', {
        encoding: 'utf-8',
      }),
    )) as envTemplateType;
    Logger.debug(supportedEnv);
    return supportedEnv;
  };
}
