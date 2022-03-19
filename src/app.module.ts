import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AppService } from './app.service';

@Module({
  imports: [HttpModule],
  controllers: [],
  providers: [AppService],
})

export class AppModule {}
