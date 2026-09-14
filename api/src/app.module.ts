import { Module } from '@nestjs/common';
import { TasksModule } from './tasks/tasks.module.js';

@Module({
  imports: [
    TasksModule,
  ],
})
export class AppModule {}