import { Controller, Get, HttpCode, HttpStatus, Post, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { ResponseMeta } from '../common/decorators/response-meta.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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

  @Post('reports/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ResponseMeta('Approved successfully', '006')
  @ApiOperation({ summary: 'Approve a submitted report (SUBMITTED → APPROVED)' })
  approve(@Param('id') id: string) {
    return this.adminService.approve(id);
  }

  @Post('reports/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ResponseMeta('Rejected successfully', '007')
  @ApiOperation({ summary: 'Reject a submitted report (SUBMITTED → REJECTED)' })
  reject(@Param('id') id: string) {
    return this.adminService.reject(id);
  }
}
