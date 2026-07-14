import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum MessageStatus {
  UNREAD = 'unread',
  READ = 'read',
  REPLIED = 'replied',
  ARCHIVED = 'archived',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  subject: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ length: 200 })
  senderName: string;

  @Column({ length: 200 })
  senderEmail: string;

  @Column({ nullable: true })
  senderPhone: string;

  @Column({ length: 50, default: MessageStatus.UNREAD })
  @Index()
  status: MessageStatus;

  @Column({ nullable: true })
  assignedTo: string;

  @Column({ type: 'text', nullable: true })
  reply: string;

  @Column({ nullable: true })
  repliedAt: Date;

  @Column({ nullable: true })
  repliedBy: string;

  @Column({ nullable: true })
  orderId: string;

  @Column({ nullable: true })
  productId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
