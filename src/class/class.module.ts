import { Module } from '@nestjs/common';
import { ClassService } from './class.service';
import { ClassController } from './class.controller';
import { ModuleModule } from 'src/module/module.module';

@Module({
  imports: [ModuleModule],
  providers: [ClassService],
  controllers: [ClassController],
})
export class ClassModule {}
