import { Module } from '@nestjs/common';
import { CourseModule } from './course/course.module';
import { ModuleModule } from './module/module.module';
import { ClassModule } from './class/class.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { S3Module } from './s3/s3.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CourseModule,
    ModuleModule,
    ClassModule,
    PrismaModule,
    S3Module,
  ],
})
export class AppModule {}
