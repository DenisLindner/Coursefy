import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/s3/s3.service';
import { CreateCourseDTO } from './dto/create-course.dto';
import { UpdateCourseDTO } from './dto/update-course.dto';
import { ConfigService } from '@nestjs/config';
import { CourseResponseDTO } from './dto/response-course.dto';

@Injectable()
export class CourseService {
  private endpoint: string;
  private logger = new Logger(CourseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    config: ConfigService,
  ) {
    this.endpoint = config.get<string>('AWS_S3_ENDPOINT')!;
  }

  async create(
    data: CreateCourseDTO,
    image?: Express.Multer.File,
  ): Promise<CourseResponseDTO> {
    const courseExists = await this.prisma.course.findFirst({
      where: { title: { equals: data.title, mode: 'insensitive' } },
    });

    if (courseExists) {
      throw new ConflictException('This title is already used');
    }

    let imageUrl: string | undefined;
    if (image) {
      imageUrl = await this.s3Service.uploadPhoto(image);
    }

    const course = await this.prisma.course.create({
      data: {
        title: data.title,
        description: data.description,
        image_url: imageUrl ? imageUrl : null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        image_url: true,
      },
    });

    return this.formatCourse(
      {
        id: course.id,
        title: course.title,
        description: course.description,
        imageUrl: course.image_url,
      },
      0,
    );
  }

  async findAll(): Promise<CourseResponseDTO[]> {
    const courses = await this.prisma.course.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        image_url: true,
        _count: { select: { modules: true } },
      },
    });

    return courses.map((item) => {
      return this.formatCourse(
        {
          id: item.id,
          title: item.title,
          description: item.description,
          imageUrl: item.image_url,
        },
        item._count.modules,
      );
    });
  }

  async findById(id: string): Promise<CourseResponseDTO> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        image_url: true,
        _count: { select: { modules: true } },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found with this id');
    }

    return this.formatCourse(
      {
        id: course.id,
        title: course.title,
        description: course.description,
        imageUrl: course.image_url,
      },
      course._count.modules,
    );
  }

  async updatePhoto(
    id: string,
    file: Express.Multer.File,
  ): Promise<CourseResponseDTO> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        image_url: true,
        _count: {
          select: {
            modules: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found with this id');
    }

    const imageUrl = await this.s3Service.uploadPhoto(file);

    await this.prisma.course.update({
      where: { id },
      data: { image_url: imageUrl },
      select: {
        id: true,
        image_url: true,
      },
    });

    if (course.image_url) {
      try {
        await this.s3Service.deleteFile(course.image_url);
      } catch (s3Error) {
        const msg =
          s3Error instanceof Error ? s3Error.message : String(s3Error);
        this.logger.warn(
          `Failed to delete file from s3 for course ${id}: ${msg}`,
        );
      }
    }

    return this.formatCourse(
      {
        id: course.id,
        title: course.title,
        description: course.description,
        imageUrl,
      },
      course._count.modules,
    );
  }

  async update(id: string, data: UpdateCourseDTO): Promise<CourseResponseDTO> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found with this id');
    }

    const courseUpdated = await this.prisma.course.update({
      where: { id: course.id },
      data: { title: data?.title, description: data?.description },
      select: {
        title: true,
        description: true,
        image_url: true,
        _count: { select: { modules: true } },
      },
    });

    return this.formatCourse(
      {
        id,
        title: courseUpdated.title,
        description: courseUpdated.description,
        imageUrl: courseUpdated.image_url,
      },
      courseUpdated._count.modules,
    );
  }

  async deleteById(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        image_url: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found with this id');
    }

    if (course.image_url) {
      try {
        await this.s3Service.deleteFile(course.image_url);
      } catch (s3Error) {
        const msg =
          s3Error instanceof Error ? s3Error.message : String(s3Error);
        this.logger.warn(
          `Failed to delete file from s3 for course ${id}: ${msg}`,
        );
      }
    }

    await this.prisma.course.delete({ where: { id } });
  }

  private formatCourse(
    course: {
      id: string;
      title: string;
      description: string;
      imageUrl: string | null;
    },
    moduleQuantity: number,
  ): CourseResponseDTO {
    return {
      id: course.id,
      title: course.title,
      description: course.description,
      imageUrl: course.imageUrl ? this.endpoint + course.imageUrl : null,
      moduleQuantity,
    };
  }
}
