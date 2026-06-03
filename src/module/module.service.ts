import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/s3/s3.service';
import { CreateModuleDTO } from './dto/create-module.dto';
import { ModuleResponseDTO } from './dto/response-module.dto';
import { UpdateModuleDTO } from './dto/update-module.dto';

@Injectable()
export class ModuleService {
  private endpoint: string;
  private logger = new Logger(ModuleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    config: ConfigService,
  ) {
    this.endpoint = config.get<string>('AWS_S3_ENDPOINT')!;
  }

  async create(
    data: CreateModuleDTO,
    image?: Express.Multer.File,
  ): Promise<ModuleResponseDTO> {
    const courseExists = await this.prisma.course.findUnique({
      where: { id: data.courseId },
    });

    if (!courseExists) {
      throw new NotFoundException('Course not found with this id');
    }

    const moduleExists = await this.prisma.module.findFirst({
      where: {
        course_id: data.courseId,
        title: { equals: data.title, mode: 'insensitive' },
      },
    });

    if (moduleExists) {
      throw new ConflictException('This title is already used');
    }

    let imageUrl: string | undefined;
    if (image) {
      imageUrl = await this.s3Service.uploadPhoto(image);
    }

    const module = await this.prisma.module.create({
      data: {
        title: data.title,
        description: data.description,
        image_url: imageUrl ? imageUrl : null,
        course_id: data.courseId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        image_url: true,
        course_id: true,
      },
    });

    return this.formatModule(
      {
        id: module.id,
        title: module.title,
        description: module.description,
        imageUrl: module.image_url,
        courseId: module.course_id,
      },
      0,
    );
  }

  async findAllByCourseId(courseId: string): Promise<ModuleResponseDTO[]> {
    const courseExists = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!courseExists) {
      throw new NotFoundException('Course not found with this id');
    }

    const modules = await this.prisma.module.findMany({
      where: { course_id: courseId },
      select: {
        id: true,
        title: true,
        description: true,
        image_url: true,
        _count: { select: { classes: true } },
        course_id: true,
      },
    });

    return modules.map((item) => {
      return this.formatModule(
        {
          id: item.id,
          title: item.title,
          description: item.description,
          imageUrl: item.image_url,
          courseId: item.course_id,
        },
        item._count.classes,
      );
    });
  }

  async findById(id: string): Promise<ModuleResponseDTO> {
    const module = await this.prisma.module.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        image_url: true,
        _count: { select: { classes: true } },
        course_id: true,
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found with this id');
    }

    return this.formatModule(
      {
        id: module.id,
        title: module.title,
        description: module.description,
        imageUrl: module.image_url,
        courseId: module.course_id,
      },
      module._count.classes,
    );
  }

  async updatePhoto(
    id: string,
    file: Express.Multer.File,
  ): Promise<ModuleResponseDTO> {
    const module = await this.prisma.module.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        image_url: true,
        _count: {
          select: {
            classes: true,
          },
        },
        course_id: true,
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found with this id');
    }

    const imageUrl = await this.s3Service.uploadPhoto(file);

    await this.prisma.module.update({
      where: { id },
      data: { image_url: imageUrl },
      select: {
        id: true,
        image_url: true,
      },
    });

    if (module.image_url) {
      try {
        await this.s3Service.deleteFile(module.image_url);
      } catch (s3Error) {
        const msg =
          s3Error instanceof Error ? s3Error.message : String(s3Error);
        this.logger.warn(
          `Failed to delete file from s3 for module ${id}: ${msg}`,
        );
      }
    }

    return this.formatModule(
      {
        id: module.id,
        title: module.title,
        description: module.description,
        imageUrl,
        courseId: module.course_id,
      },
      module._count.classes,
    );
  }

  async update(id: string, data: UpdateModuleDTO): Promise<ModuleResponseDTO> {
    const module = await this.prisma.module.findUnique({
      where: { id },
      select: {
        id: true,
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found with this id');
    }

    const moduleUpdated = await this.prisma.module.update({
      where: { id: module.id },
      data: { title: data?.title, description: data?.description },
      select: {
        title: true,
        description: true,
        image_url: true,
        _count: { select: { classes: true } },
        course_id: true,
      },
    });

    return this.formatModule(
      {
        id,
        title: moduleUpdated.title,
        description: moduleUpdated.description,
        imageUrl: moduleUpdated.image_url,
        courseId: moduleUpdated.course_id,
      },
      moduleUpdated._count.classes,
    );
  }

  async deleteById(id: string) {
    const module = await this.prisma.module.findUnique({
      where: { id },
      select: {
        id: true,
        image_url: true,
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found with this id');
    }

    if (module.image_url) {
      try {
        await this.s3Service.deleteFile(module.image_url);
      } catch (s3Error) {
        const msg =
          s3Error instanceof Error ? s3Error.message : String(s3Error);
        this.logger.warn(
          `Failed to delete file from s3 for module ${id}: ${msg}`,
        );
      }
    }

    await this.prisma.module.delete({ where: { id } });
  }

  private formatModule(
    module: {
      id: string;
      title: string;
      description: string;
      imageUrl: string | null;
      courseId: string;
    },
    classQuantity: number,
  ): ModuleResponseDTO {
    return {
      id: module.id,
      title: module.title,
      description: module.description,
      imageUrl: module.imageUrl ? this.endpoint + module.imageUrl : null,
      classQuantity,
      courseId: module.courseId,
    };
  }
}
