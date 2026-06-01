import { Injectable } from '@nestjs/common';
import { ModuleService } from 'src/module/module.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/s3/s3.service';

@Injectable()
export class ClassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly moduleService: ModuleService,
  ) {}
}
