import type { EventKeys } from 'src/types/triggers';
import { TriggerContext, ActionConfig, TriggerExecutionResult } from './trigger.interface';

export interface IEventHandler {
    process(context: TriggerContext): Promise<boolean>;
}

export interface IActionHandler {
    execute(context: TriggerContext, configs: ActionConfig, event: EventKeys): Promise<TriggerExecutionResult>;
}

export interface IFilterHandler {
    apply(context: TriggerContext, filter: any): Promise<boolean>;
}