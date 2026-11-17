import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  loadPatientProfile,
  loadInfoQuestions,
  askInfoQuestion,
  apiError,
  type PatientProfile,
  type InfoQuestion,
} from "../data/api";

export function PatientProfileCard({ userId }: { userId: string }) {
  const [showAll, setShowAll] = useState(false);
  const query = useQuery({
    queryKey: ["patientProfile", userId],
    queryFn: () => loadPatientProfile(userId),
  });

  if (query.isLoading) return <div className="card card-pad">در حال بارگیری...</div>;
  if (query.isError) return <div className="card card-pad">{apiError(query.error)}</div>;
  const p = query.data as PatientProfile;

  const bmi = p.bmi ? p.bmi.toFixed(1) : "—";
  const goalLabel: Record<string, string> = {
    weight_loss: "کاهش وزن",
    weight_gain: "افزایش وزن",
    pregnancy: "بارداری/شیردهی",
    detox: "سلامت عمومی",
  };

  return (
    <section className="card card-pad">
      <h3>پروفایل کاربر</h3>
      <div className="info-grid">
        <div><strong>نام:</strong> {p.name}</div>
        <div><strong>هدف:</strong> {goalLabel[p.goal] || p.goal}</div>
        <div><strong>سن:</strong> {p.age ?? "—"}</div>
        <div><strong>جنسیت:</strong> {p.sex === "male" ? "مرد" : p.sex === "female" ? "زن" : "—"}</div>
        <div><strong>وزن فعلی:</strong> {p.currentWeightKg ?? "—"} کیلو</div>
        <div><strong>وزن هدف:</strong> {p.targetWeightKg ?? "—"} کیلو</div>
        <div><strong>قد:</strong> {p.heightCm ?? "—"} سانتی‌متر</div>
        <div><strong>BMI:</strong> {bmi}</div>
        <div><strong>کالری هدف:</strong> {p.targetKcal} کیلوکالری</div>
        <div><strong>پروتئین:</strong> {p.proteinG}g</div>
        <div><strong>کربوهیدرات:</strong> {p.carbsG}g</div>
        <div><strong>چربی:</strong> {p.fatG}g</div>
      </div>
      <div className="mt-2">
        <strong>آلرژی‌ها:</strong> {p.allergens.length > 0 ? p.allergens.join("، ") : "ندارد"}
      </div>
      <div className="mt-1">
        <strong>سطح ایمنی:</strong> {p.safetyTier === "doctor_only" ? "⚠️ نیاز به تأیید متخصص" : "✓ امن برای AI"}
      </div>

      {!showAll && <button type="button" className="secondary mt-2" onClick={() => setShowAll(true)}>نمایش تاریخچه وزن و سوالات</button>}

      {showAll && (
        <>
          <h4 className="mt-3">تاریخچه وزن</h4>
          {p.weightHistory.length === 0 && <p className="text-secondary">وزنی ثبت نشده</p>}
          {p.weightHistory.length > 0 && (
            <table className="mini-table">
              <thead>
                <tr><th>تاریخ</th><th>وزن (کیلو)</th></tr>
              </thead>
              <tbody>
                {p.weightHistory.slice(0, 10).map((w, i) => (
                  <tr key={i}><td>{w.date}</td><td>{w.kg}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}

export function InfoQuestionsPanel({ requestId }: { requestId: string }) {
  const [newQ, setNewQ] = useState("");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["infoQuestions", requestId],
    queryFn: () => loadInfoQuestions(requestId),
  });
  const mutation = useMutation({
    mutationFn: (text: string) => askInfoQuestion(requestId, text),
    onSuccess: () => {
      setNewQ("");
      client.invalidateQueries({ queryKey: ["infoQuestions", requestId] });
    },
  });

  const questions = query.data as InfoQuestion[] | undefined;

  return (
    <section className="card card-pad">
      <h3>سوالات تکمیلی</h3>
      {query.isLoading && <p>در حال بارگیری...</p>}
      {questions && questions.length === 0 && <p className="text-secondary">سوالی ثبت نشده</p>}
      {questions && questions.length > 0 && (
        <ul className="stack-sm">
          {questions.map((q) => (
            <li key={q.id}>
              <strong>سوال:</strong> {q.text}
              <br />
              <span className="text-secondary">{q.status}</span>
              {q.answer && <div className="mt-1"><strong>پاسخ:</strong> {q.answer}</div>}
            </li>
          ))}
        </ul>
      )}
      <hr className="my-2" />
      <label>
        <strong>سوال جدید:</strong>
        <textarea value={newQ} onChange={(e) => setNewQ(e.target.value)} rows={3} placeholder="برای مثال: آیا بیماری خاصی دارید؟" />
      </label>
      <button className="mt-1" disabled={!newQ.trim() || mutation.isPending} onClick={() => mutation.mutate(newQ)}>
        {mutation.isPending ? "در حال ارسال..." : "ارسال سوال"}
      </button>
      {mutation.isError && <p className="text-danger mt-1">{apiError(mutation.error)}</p>}
    </section>
  );
}
