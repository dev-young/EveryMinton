import {
  collection,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Feedback } from "@/types";
import type { FeedbackRepository } from "../interfaces";

const COLLECTION = "feedbacks";

export class FirebaseFeedbackRepository implements FeedbackRepository {
  private get ref() {
    return collection(db, COLLECTION);
  }

  async create(
    feedback: Omit<Feedback, "id" | "createdAt" | "status">
  ): Promise<Feedback> {
    const createdAt = Timestamp.now();
    const status: Feedback["status"] = "new";
    const docRef = await addDoc(this.ref, {
      ...feedback,
      status,
      createdAt,
    });

    return {
      id: docRef.id,
      ...feedback,
      status,
      createdAt: createdAt.toDate(),
    };
  }
}
