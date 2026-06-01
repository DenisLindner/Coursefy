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
  UseInterceptors,
} from '@nestjs/common';
import { ModuleService } from './module.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateModuleDTO } from './dto/create-module.dto';
import { UpdateModuleDTO } from './dto/update-module.dto';

@Controller('module')
export class ModuleController {
  constructor(private readonly service: ModuleService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('photo', {
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(
            new BadRequestException(
              'Only images (jpg, jpeg, png, webp) is allowed!',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async create(
    @Body() data: CreateModuleDTO,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({
            maxSize: 3 * 1024 * 1024,
            message: 'Max size is 3mb for photos',
          }),
        ],
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.service.create(data, file);
  }

  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id/photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(
            new BadRequestException(
              'Only images (jpg, jpeg, png, webp) is allowed!',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async updatePhoto(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 3 * 1024 * 1024,
            message: 'Max size is 3mb for photos',
          }),
        ],
      }),
    )
    file?: Express.Multer.File,
  ) {
    if (file) {
      return this.service.updatePhoto(id, file);
    }
    throw new BadRequestException('File not found');
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: UpdateModuleDTO) {
    console.log(data);

    return this.service.update(id, data);
  }

  @Delete(':id')
  async deleteById(@Param('id') id: string) {
    return this.service.deleteById(id);
  }
}
