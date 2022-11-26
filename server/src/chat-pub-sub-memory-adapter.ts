import { Message, Session } from "@prisma/client";
import EventEmitter from "events";
import { ChatPubSubPort, MessageWithSession } from "./routers/chat-router";

declare interface TypedEventEmitter {
  on(event: string, listener: (message: MessageWithSession) => void): this;
  off(event: string, listener: (message: MessageWithSession) => void): this;
  emit(event: string, message: MessageWithSession): boolean;
}
class TypedEventEmitter extends EventEmitter {}

export class ChatPubSubMemoryAdapter implements ChatPubSubPort {
  private readonly emitter: TypedEventEmitter;

  constructor() {
    this.emitter = new TypedEventEmitter();
  }

  async publishMessage(
    chatId: string,
    message: Message & { sender: Session }
  ): Promise<void> {
    this.emitter.emit(chatId, message);
  }

  async subscribeToChat(
    chatId: string,
    listener: (newMessage: Message & { sender: Session }) => void
  ): Promise<void> {
    this.emitter.on(chatId, listener);
  }

  async unsubscribeToChat(
    chatId: string,
    listener: (newMessage: Message & { sender: Session }) => void
  ): Promise<void> {
    this.emitter.off(chatId, listener);
  }
}
