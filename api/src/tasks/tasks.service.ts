import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Task } from './task.entity.js';

@Injectable()
export class TasksService {
  private readonly tasks: Task[] = [];

  findAll(): Task[] {
    return this.tasks;
  }

  findOne(id: string): Task {
    const task = this.tasks.find((item) => item.id === id);

    if (!task) {
      throw new NotFoundException(`Task ${id} was not found`);
    }

    return task;
  }

  create(title: string, description: string): Task {
    const now = new Date();
    const task: Task = {
      id: randomUUID(),
      title,
      description,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.unshift(task);
    return task;
  }

  update(id: string, changes: Partial<Task>): Task {
    const task = this.findOne(id);

    Object.assign(task, changes, { updatedAt: new Date() });

    return task;
  }

  remove(id: string): void {
    const taskIndex = this.tasks.findIndex((item) => item.id === id);

    if (taskIndex === -1) {
      throw new NotFoundException(`Task ${id} was not found`);
    }

    this.tasks.splice(taskIndex, 1);
  }
}