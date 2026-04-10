"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import "react-calendar/dist/Calendar.css";
import Image from "next/image";
import type { CalendarProps } from "react-calendar";
import type { ComponentType } from "react";

// Render the calendar only on the client to avoid SSR/CSR text mismatches
// caused by locale/timezone differences in month names
const Calendar = dynamic(() => import("react-calendar"), {
  ssr: false,
}) as ComponentType<CalendarProps>;

type ValuePiece = Date | null;

type Value = ValuePiece | [ValuePiece, ValuePiece];

// مؤقت
const events = [
  {
    id: 1,
    title: "تم تأجيل درس الحاسوب",
    time: "12:00 PM - 2:00 PM",
    description: "استاذ الحاسوب مسافر",
  },
  {
    id: 2,
    title: "اجتماع أولياء الأمور",
    time: "10:00 AM - 11:00 AM",
    description: "اجتماع مع أولياء الأمور في قاعة الاجتماعات",
  },
  {
    id: 3,
    title: "اختبار رياضيات",
    time: "9:00 AM - 10:30 AM",
    description: "اختبار منتصف الفصل في مادة الرياضيات",
  },
];

const EventCalender = () => {
  const [value, onChange] = useState<Value>(new Date());

  return (
    <div className="bg-white gap-4 p-3">
      <Calendar onChange={onChange as CalendarProps["onChange"]} value={value} />

    </div>
  );
};

export default EventCalender;
