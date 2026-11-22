import { Module } from '@nestjs/common';
import { GeminiEvaluationAdapter } from './gemini-evaluation.adapter.js';

@Module({
  providers: [GeminiEvaluationAdapter],
  exports: [GeminiEvaluationAdapter],
})
export class AiEvaluationModule {}
