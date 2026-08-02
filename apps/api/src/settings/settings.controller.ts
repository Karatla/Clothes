import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async getAll() {
    return this.settings.getAll();
  }

  @Put()
  async update(@Body() body: Record<string, unknown>) {
    return this.settings.update(body ?? {});
  }

  @Post('reset')
  async reset() {
    return this.settings.reset();
  }
}
