import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Schedule } from "@/types";
import { ScheduleRepository } from "../interfaces";

const COLLECTION = "schedules";

export class FirebaseScheduleRepository implements ScheduleRepository {
  private get ref() {
    return collection(db, COLLECTION);
  }

  async getAll(): Promise<Schedule[]> {
    const q = query(this.ref, orderBy("date", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => this.toSchedule(doc.id, doc.data()));
  }

  async getById(id: string): Promise<Schedule | null> {
    const docRef = doc(db, COLLECTION, id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return this.toSchedule(snapshot.id, snapshot.data());
  }

  async create(
    schedule: Omit<Schedule, "id" | "createdAt">
  ): Promise<Schedule> {
    const docRef = await addDoc(this.ref, {
      ...schedule,
      createdAt: Timestamp.now(),
    });
    return {
      id: docRef.id,
      ...schedule,
      createdAt: new Date(),
    };
  }

  async update(
    id: string,
    data: Partial<Omit<Schedule, "id" | "createdAt">>
  ): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, data);
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  }

  private toSchedule(id: string, data: Record<string, unknown>): Schedule {
    return {
      id,
      name: typeof data.name === "string" ? data.name : "",
      date: data.date as string,
      startTime: data.startTime as string,
      endTime: data.endTime as string,
      courtCount: data.courtCount as number,
      location: data.location as string,
      status: data.status as Schedule["status"],
      createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    };
  }
}
