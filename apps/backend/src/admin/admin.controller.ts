import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminService } from './admin.service';
import { ItemsService } from '../items/items.service';
import { Roles } from '../common/decorators/roles.decorator';
import { ResponseMeta } from '../common/decorators/response-meta.decorator';
import { RejectReportDto } from './dto/reject-report.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly itemsService: ItemsService,
  ) {}

  @Get('reports')
  @ApiOperation({ summary: 'List all expense reports (admin only)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'],
  })
  findAll(@Query('status') status?: string) {
    return this.adminService.findAll(status);
  }

  @Get('reports/:id')
  @ApiOperation({ summary: 'Get a single report by ID (admin only)' })
  findOne(@Param('id') id: string) {
    return this.adminService.findOne(id);
  }

  @Get('reports/:id/items')
  @ApiOperation({ summary: 'List items for any report (admin only)' })
  findItems(@Param('id') id: string) {
    return this.itemsService.findAllForAdmin(id);
  }

  @Post('reports/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ResponseMeta('Approved successfully', '006')
  @ApiOperation({
    summary: 'Approve a submitted report (SUBMITTED → APPROVED)',
  })
  approve(@Param('id') id: string, @Req() req: Request) {
    return this.adminService.approve(id, req.user!['id']);
  }

  @Post('reports/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ResponseMeta('Rejected successfully', '007')
  @ApiOperation({ summary: 'Reject a submitted report (SUBMITTED → REJECTED)' })
  @ApiBody({ type: RejectReportDto })
  reject(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: RejectReportDto,
  ) {
    return this.adminService.reject(id, req.user!['id'], dto.note);
  }
}
