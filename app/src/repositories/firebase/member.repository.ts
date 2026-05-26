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
    // Firestore는 부분 문자열 검색을 지원하지 않으므로
    // 전체를 가져와서 클라이언트에서 필터링
    const all = await this.getAll();
    return all.filter((m) => m.name.includes(name));
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
