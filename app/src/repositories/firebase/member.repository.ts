import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  documentId,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Member } from "@/types";
import { MemberRepository } from "../interfaces";

const COLLECTION = "members";

export class FirebaseMemberRepository implements MemberRepository {
  private get ref() {
    return collection(db, COLLECTION);
  }

  async getAll(): Promise<Member[]> {
    const q = query(this.ref, orderBy("name"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => this.toMember(doc.id, doc.data()));
  }

  async getById(id: string): Promise<Member | null> {
    const docRef = doc(db, COLLECTION, id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return this.toMember(snapshot.id, snapshot.data());
  }

  async getByIds(ids: string[]): Promise<Member[]> {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (uniqueIds.length === 0) return [];

    const chunks: string[][] = [];
    for (let index = 0; index < uniqueIds.length; index += 30) {
      chunks.push(uniqueIds.slice(index, index + 30));
    }

    const snapshots = await Promise.all(
      chunks.map((chunk) =>
        getDocs(query(this.ref, where(documentId(), "in", chunk)))
      )
    );

    return snapshots
      .flatMap((snapshot) =>
        snapshot.docs.map((doc) => this.toMember(doc.id, doc.data()))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async create(member: Omit<Member, "id" | "createdAt">): Promise<Member> {
    const docRef = await addDoc(this.ref, {
      ...member,
      createdAt: Timestamp.now(),
    });
    return {
      id: docRef.id,
      ...member,
      createdAt: new Date(),
    };
  }

  async update(
    id: string,
    data: Partial<Omit<Member, "id" | "createdAt">>
  ): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, data);
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  }

  async searchByName(name: string): Promise<Member[]> {
    const q = query(this.ref, where("name", "==", name));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => this.toMember(doc.id, doc.data()));
  }

  private toMember(id: string, data: Record<string, unknown>): Member {
    return {
      id,
      name: data.name as string,
      gender: data.gender as Member["gender"],
      level: data.level as number,
      createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    };
  }
}
