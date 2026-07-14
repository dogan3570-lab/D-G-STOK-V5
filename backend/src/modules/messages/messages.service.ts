import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageStatus } from './message.entity';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
  ) {}

  async create(data: Partial<Message>): Promise<Message> {
    const message = this.messagesRepository.create(data);
    return this.messagesRepository.save(message);
  }

  async findAll(page = 1, limit = 10, status?: MessageStatus) {
    const where: any = {};
    if (status) where.status = status;

    const [data, total] = await this.messagesRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUnreadCount(): Promise<number> {
    return this.messagesRepository.count({ where: { status: MessageStatus.UNREAD } });
  }

  async findById(id: string): Promise<Message> {
    const message = await this.messagesRepository.findOne({ where: { id } });
    if (!message) throw new NotFoundException('Mesaj bulunamadi');
    return message;
  }

  async update(id: string, data: Partial<Message>): Promise<Message> {
    const message = await this.findById(id);
    Object.assign(message, data);
    return this.messagesRepository.save(message);
  }

  async reply(id: string, reply: string, userId: string): Promise<Message> {
    const message = await this.findById(id);
    message.reply = reply;
    message.status = MessageStatus.REPLIED;
    message.repliedAt = new Date();
    message.repliedBy = userId;
    return this.messagesRepository.save(message);
  }

  async markAsRead(id: string): Promise<Message> {
    const message = await this.findById(id);
    message.status = MessageStatus.READ;
    return this.messagesRepository.save(message);
  }

  async remove(id: string): Promise<void> {
    const result = await this.messagesRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Mesaj bulunamadi');
  }
}
