import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { CatalogFiltersDto } from './catalog.dto.js';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.getCategories();
  }

  @Get('activities')
  activities(@Query() filters: CatalogFiltersDto) {
    return this.catalog.listPublished(filters);
  }

  @Get('activities/:id')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalog.getActivityDetail(id);
  }
}
