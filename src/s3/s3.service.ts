import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { extname } from 'path';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(config: ConfigService) {
    this.bucketName = config.get<string>('AWS_S3_BUCKET_NAME')!;
    this.s3Client = new S3Client({
      region: config.get<string>('AWS_REGION')!,
      endpoint: config.get<string>('AWS_S3_ENDPOINT')!,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY')!,
      },
    });
  }

  async uploadPhoto(file: Express.Multer.File): Promise<string> {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExt = extname(file.originalname);
    const fileName = `images/coursefy-${uniqueSuffix}${fileExt}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      return `/${this.bucketName}/${fileName}`;
    } catch (error) {
      console.log('Server error: ' + error);
      throw new InternalServerErrorException('Error uploading file to AWS S3');
    }
  }

  async uploadVideo(file: Express.Multer.File): Promise<string> {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExt = extname(file.originalname);
    const fileName = `videos/coursefy-${uniqueSuffix}${fileExt}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      return `/${this.bucketName}/${fileName}`;
    } catch (error) {
      console.log('Server error: ' + error);
      throw new InternalServerErrorException('Error uploading file to AWS S3');
    }
  }

  async deleteFile(url: string) {
    const fileName = url.split(this.bucketName + '/')[1];

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.log('Server error: ' + error);
      throw new InternalServerErrorException('Error deleting file to AWS S3');
    }
  }
}
