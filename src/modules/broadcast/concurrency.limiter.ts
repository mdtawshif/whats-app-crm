import { Injectable } from "@nestjs/common"

@Injectable()
export class ConcurrencyLimiter {
  private queue: (() => void)[] = []
  private active = 0

  constructor(private maxConcurrent: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }

    this.active++
    try {
      return await fn()
    } finally {
      this.active--
      this.queue.shift()?.()
    }
  }

  get activeCount() {
    return this.active
  }
  get queuedCount() {
    return this.queue.length
  }
}
