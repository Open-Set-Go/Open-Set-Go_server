import { Controller, Get, Param, Res } from '@nestjs/common';
import { PrService } from './pr.service';
import { Response } from 'express';

@Controller('file/pr')
export class PrController {
  constructor(private readonly prService: PrService) {}

  // get PR template from MongoDB
  @Get()
  async getPRTemplates(@Res() res: Response) {
    const PRTemplateList = await this.prService.loadPRTemplates();
    res.status(200).send(PRTemplateList);
  }

  // get PR template content from MongoDB(filtered by _id)
  @Get('/:id')
  async getPRTemplateContent(@Res() res: Response, @Param('id') id: string) {
    const PRTemplateContent = await this.prService.loadPRTemplateContent(id);
    res.status(200).send(PRTemplateContent);
  }
}
