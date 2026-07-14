import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('listing_templates')
export class ListingTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ nullable: true })
  categoryId: string;

  @Column({ nullable: true })
  categoryName: string;

  @Column({ type: 'text', nullable: true })
  titleTemplate: string;

  @Column({ type: 'text', nullable: true })
  descriptionTemplate: string;

  @Column({ type: 'text', nullable: true })
  shortDescriptionTemplate: string;

  @Column({ type: 'text', nullable: true })
  metaTitleTemplate: string;

  @Column({ type: 'text', nullable: true })
  metaDescriptionTemplate: string;

  @Column({ type: 'text', nullable: true })
  tagsTemplate: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
