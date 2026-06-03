import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ClassService } from './class.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CreateClassDTO } from './dto/create-class.dto';
import { UpdateClassDTO } from './dto/update-class.dto';

@Controller('class')
export class ClassController {
  constructor(private readonly service: ClassService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('video', {
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(mp4)$/)) {
          return callback(
            new BadRequestException('Only videos (mp4) is allowed!'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async create(
    @Body() data: CreateClassDTO,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({
            maxSize: 1000 * 1024 * 1024,
            message: 'Max size is 1gb for videos',
          }),
        ],
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.service.create(data, file);
  }

  @Get('module/:moduleId')
  async findAllByModuleId(@Param('moduleId') moduleId: string) {
    return this.service.findAllByModuleId(moduleId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id/video')
  @UseInterceptors(
    FileInterceptor('video', {
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(mp4)$/)) {
          return callback(
            new BadRequestException('Only videos (mp4) is allowed!'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async updateVideo(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({
            maxSize: 1000 * 1024 * 1024,
            message: 'Max size is 1gb for videos',
          }),
        ],
      }),
    )
    file?: Express.Multer.File,
  ) {
    if (file) {
      return this.service.updateVideo(id, file);
    }
    throw new BadRequestException('Files not found');
  }

  @Patch(':id/files')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(pdf|md|docx|txt)$/)) {
          return callback(
            new BadRequestException(
              'Only files (pdf, md, docx, txt) is allowed!',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async updateFiles(
    @Param('id') id: string,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    if (files) {
      const maxSize = 10 * 1024 * 1024;

      files.forEach((element) => {
        if (element.size > maxSize) {
          throw new BadRequestException('Max size is 10mb for files');
        }
      });

      return this.service.updateFiles(id, files);
    }
    throw new BadRequestException('Files not found');
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: UpdateClassDTO) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  async deleteById(@Param('id') id: string) {
    return this.service.deleteById(id);
  }
}
