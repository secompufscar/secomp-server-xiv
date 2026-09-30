import eventRepository from "../repositories/eventRepository";
import userEventRepository from "../repositories/userEventRepository";
import { CreateEventDTOS, UpdateEventDTOS, EventDTOS } from "../dtos/eventDtos";
import { ApiError, ErrorsCode } from "../utils/api-errors";

export default {
  async findById(id: string): Promise<EventDTOS> {
    const event = await eventRepository.findById(id);

    if (!event) {
      throw new ApiError("Event was not found by this id", ErrorsCode.NOT_FOUND);
    }
    return event;
  },

  async list(): Promise<EventDTOS[]> {
    const events = await eventRepository.list();
    return events;
  },

  async getUserRegistration(userId: string) {
    const currentEvent = await this.findCurrent();
    if (!currentEvent) {
      throw new ApiError("Event was not found by this id", ErrorsCode.NOT_FOUND);
    }

    const registration = await userEventRepository.findByUserAndEvent(userId, currentEvent.id);
    if (!registration) {
      throw new ApiError("Event was not found by this userId and eventID", ErrorsCode.NOT_FOUND);
    }
    return registration;
  },

  async findCurrent(): Promise<EventDTOS | null> {
    const currentEvent = await eventRepository.findCurrent();
    return currentEvent;
  },

  async create(data: CreateEventDTOS): Promise<EventDTOS> {
    return eventRepository.createWithRegistrationReset(data);
  },

  async update(id: string, data: UpdateEventDTOS): Promise<EventDTOS> {
    const existingEvent = await eventRepository.findById(id);
    if (!existingEvent) {
      throw new ApiError("event was not found by this id", ErrorsCode.NOT_FOUND);
    }

    const updatedEvent = await eventRepository.update(id, data);
    return updatedEvent;
  },

  async deactivate(id: string): Promise<EventDTOS> {
    const existingEvent = await eventRepository.findById(id);
    if (!existingEvent) {
      throw new ApiError("event was not found by this id", ErrorsCode.NOT_FOUND);
    }

    const deactivatedEvent = await eventRepository.deactivate(id);

    return deactivatedEvent;
  },

  async delete(eventId: string): Promise<void> {
    await eventRepository.deleteWithRegistrationClosure(eventId);
  },
};
