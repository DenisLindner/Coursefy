import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/s3/s3.service';
import { ClassResponseDTO } from './dto/response-class.dto';
import { CreateClassDTO } from './dto/create-class.dto';
import { UpdateClassDTO } from './dto/update-class.dto';

@Injectable()
export class ClassService {
  private endpoint: string;
  private logger = new Logger(ClassService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    config: ConfigService,
  ) {
    this.endpoint = config.get<string>('AWS_S3_ENDPOINT')!;
  }

  async create(
    data: CreateClassDTO,
    video?: Express.Multer.File,
  ): Promise<ClassResponseDTO> {
    const moduleExists = await this.prisma.module.findUnique({
      where: { id: data.moduleId },
    });

    if (!moduleExists) {
      throw new NotFoundException('Module not found with this id');
    }

    const classExists = await this.prisma.class.findFirst({
      where: {
        module_id: data.moduleId,
        title: { equals: data.title, mode: 'insensitive' },
      },
    });

    if (classExists) {
      throw new ConflictException('This title is already used');
    }

    let videoUrl: string | undefined;
    if (video) {
      videoUrl = await this.s3Service.uploadVideo(video);
    }

    const classEntity = await this.prisma.class.create({
      data: {
        title: data.title,
        description: data.description,
        video_url: videoUrl ?? null,
        module_id: data.moduleId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        video_url: true,
        files_url: {
          select: {
            file_url: true,
          },
        },
        module_id: true,
      },
    });

    return this.formatClass({
      id: classEntity.id,
      title: classEntity.title,
      description: classEntity.description,
      videoUrl: classEntity.video_url,
      filesUrl: classEntity.files_url
        ? this.transformEntityToString(classEntity.files_url)
        : [],
      moduleId: classEntity.module_id,
    });
  }

  async findAllByModuleId(moduleId: string): Promise<ClassResponseDTO[]> {
    const moduleExists = await this.prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!moduleExists) {
      throw new NotFoundException('Module not found with this id');
    }

    const classes = await this.prisma.class.findMany({
      where: { module_id: moduleId },
      select: {
        id: true,
        title: true,
        description: true,
        video_url: true,
        files_url: {
          select: {
            file_url: true,
          },
        },
        module_id: true,
      },
    });

    return classes.map((item) => {
      return this.formatClass({
        id: item.id,
        title: item.title,
        description: item.description,
        videoUrl: item.video_url,

        filesUrl: this.transformEntityToString(item.files_url),
        moduleId: item.module_id,
      });
    });
  }

  async findById(id: string): Promise<ClassResponseDTO> {
    const classEntity = await this.prisma.class.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        video_url: true,
        files_url: {
          select: {
            file_url: true,
          },
        },
        module_id: true,
      },
    });

    if (!classEntity) {
      throw new NotFoundException('Class not found with this id');
    }

    return this.formatClass({
      id: classEntity.id,
      title: classEntity.title,
      description: classEntity.description,
      videoUrl: classEntity.video_url,

      filesUrl: this.transformEntityToString(classEntity.files_url),
      moduleId: classEntity.module_id,
    });
  }

  async updateVideo(
    id: string,
    file: Express.Multer.File,
  ): Promise<ClassResponseDTO> {
    const classEntity = await this.prisma.class.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        video_url: true,
        files_url: {
          select: {
            file_url: true,
          },
        },
        module_id: true,
      },
    });

    if (!classEntity) {
      throw new NotFoundException('Class not found with this id');
    }

    const videoUrl = await this.s3Service.uploadVideo(file);

    await this.prisma.class.update({
      where: { id },
      data: { video_url: videoUrl },
      select: {
        id: true,
        video_url: true,
      },
    });

    if (classEntity.video_url) {
      try {
        await this.s3Service.deleteFile(classEntity.video_url);
      } catch (s3Error) {
        const msg =
          s3Error instanceof Error ? s3Error.message : String(s3Error);
        this.logger.warn(
          `Failed to delete file from s3 for class ${id}: ${msg}`,
        );
      }
    }

    return this.formatClass({
      id: classEntity.id,
      title: classEntity.title,
      description: classEntity.description,
      videoUrl,

      filesUrl: this.transformEntityToString(classEntity.files_url),
      moduleId: classEntity.module_id,
    });
  }

  async updateFiles(id: string, files: Express.Multer.File[]) {
    const classEntity = await this.prisma.class.findUnique({
      where: { id },
      select: {
        id: true,
        files_url: {
          select: {
            file_url: true,
          },
        },
      },
    });

    if (!classEntity) {
      throw new NotFoundException('Class not found with this id');
    }

    const filesUrl = await Promise.all(
      files.map((item) => this.s3Service.uploadFile(item)),
    );

    for (const item of filesUrl) {
      await this.prisma.file.create({
        data: { class_id: classEntity.id, file_url: item },
      });
    }

    if (classEntity.files_url) {
      for (const file of classEntity.files_url) {
        try {
          await this.s3Service.deleteFile(file.file_url);
        } catch (s3Error) {
          const msg =
            s3Error instanceof Error ? s3Error.message : String(s3Error);
          this.logger.warn(
            `Failed to delete file from s3 for class ${id}: ${msg}`,
          );
        }
      }
    }

    const classUpdated = await this.prisma.class.findUnique({
      where: { id: classEntity.id },
      select: {
        id: true,
        title: true,
        description: true,
        video_url: true,
        files_url: {
          select: {
            file_url: true,
          },
        },
        module_id: true,
      },
    });

    if (!classUpdated) {
      throw new NotFoundException('Class not found with this id');
    }

    return this.formatClass({
      id: classUpdated.id,
      title: classUpdated.title,
      description: classUpdated.description,
      videoUrl: classUpdated.video_url,
      moduleId: classUpdated.module_id,
      filesUrl: this.transformEntityToString(classEntity.files_url),
    });
  }

  async update(id: string, data: UpdateClassDTO): Promise<ClassResponseDTO> {
    const classEntity = await this.prisma.class.findUnique({
      where: { id },
      select: {
        id: true,
      },
    });

    if (!classEntity) {
      throw new NotFoundException('Class not found with this id');
    }

    const classEntityUpdated = await this.prisma.class.update({
      where: { id: classEntity.id },
      data: { title: data?.title, description: data?.description },
      select: {
        title: true,
        description: true,
        video_url: true,
        files_url: {
          select: {
            file_url: true,
          },
        },
        module_id: true,
      },
    });

    return this.formatClass({
      id,
      title: classEntityUpdated.title,
      description: classEntityUpdated.description,
      videoUrl: classEntityUpdated.video_url,

      filesUrl: this.transformEntityToString(classEntityUpdated.files_url),
      moduleId: classEntityUpdated.module_id,
    });
  }

  async deleteById(id: string) {
    const classEntity = await this.prisma.class.findUnique({
      where: { id },
      select: {
        id: true,
        video_url: true,
        files_url: {
          select: {
            file_url: true,
          },
        },
      },
    });

    if (!classEntity) {
      throw new NotFoundException('Class not found with this id');
    }

    if (classEntity.video_url) {
      try {
        await this.s3Service.deleteFile(classEntity.video_url);
      } catch (s3Error) {
        const msg =
          s3Error instanceof Error ? s3Error.message : String(s3Error);
        this.logger.warn(
          `Failed to delete file from s3 for class ${id}: ${msg}`,
        );
      }
    }

    if (classEntity.files_url) {
      for (const file of classEntity.files_url) {
        try {
          await this.s3Service.deleteFile(file.file_url);
        } catch (s3Error) {
          const msg =
            s3Error instanceof Error ? s3Error.message : String(s3Error);
          this.logger.warn(
            `Failed to delete file from s3 for class ${id}: ${msg}`,
          );
        }
      }
    }

    await this.prisma.class.delete({ where: { id } });
  }

  private formatClass(classEntity: {
    id: string;
    title: string;
    description: string;
    videoUrl: string | null;
    filesUrl: string[];
    moduleId: string;
  }): ClassResponseDTO {
    return {
      id: classEntity.id,
      title: classEntity.title,
      description: classEntity.description,
      videoUrl: classEntity.videoUrl
        ? this.endpoint + classEntity.videoUrl
        : null,
      filesUrl: classEntity.filesUrl.map((item) => this.endpoint + item),
      moduleId: classEntity.moduleId,
    };
  }

  private transformEntityToString(files_url: { file_url: string }[]): string[] {
    const value: string[] = [];

    files_url.forEach((item) => {
      value.push(item.file_url);
    });

    return value;
  }
}
