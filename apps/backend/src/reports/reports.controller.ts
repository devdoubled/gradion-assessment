import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ResponseMeta } from '../common/decorators/response-meta.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new expense report (starts as DRAFT)' })
  create(@Req() req: Request, @Body() dto: CreateReportDto) {
    return this.reportsService.create(req.user!['id'], dto);
  }

  @Get()
  @ApiOperation({ summary: 'List own expense reports' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'],
  })
  findAll(@Req() req: Request, @Query('status') status?: string) {
    return this.reportsService.findAll(req.user!['id'], status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single own expense report' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.reportsService.findOneOwned(id, req.user!['id']);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a DRAFT expense report' })
  update(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: UpdateReportDto,
  ) {
    return this.reportsService.update(id, req.user!['id'], dto);
  }

  @Delete(':id')
  @ResponseMeta('Delete successfully', '004')
  @ApiOperation({ summary: 'Delete a DRAFT expense report' })
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.reportsService.remove(id, req.user!['id']);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ResponseMeta('Submit successfully', '005')
  @ApiOperation({
    summary: 'Submit a DRAFT report for approval (DRAFT → SUBMITTED)',
  })
  submit(@Param('id') id: string, @Req() req: Request) {
    return this.reportsService.submit(id, req.user!['id']);
  }
}
