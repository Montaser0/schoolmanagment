"use client"
import { useState } from 'react';
import Image from 'next/image';

const FormModel = ({
    table,
    type,
    data,
    id,
}: {
    table:
    | "teacher"
    | "student"
    | "parent"
    | "subject"
    | "class"
    | "lesson"
    | "exam"
    | "assignment"
    | "result"
    | "attendance"
    | "event"
    | "announcement";
    type: "create" | "update" | "delete" ;
    data?: any;
    id?: number;
}) => {
    const size = type === "create" ? "w-8 h-8" : "w-7 h-7";
    const bgColor =
        type === "create"
            ? "bg-Yellow"
            : type === "update"
                ? "bg-sky"
                : "bg-purple";
    const [open, setOpen] = useState(false);

    const Form = () => {
        if (type === "delete" && id) {
            return (
                <form action='' className='p-4 flex flex-col gap-4'>
                    <h2 className='text-2xl font-bold'>حذف {table}</h2>
                    <p className='text-sm'>هل أنت متأكد من حذف هذا العنصر؟</p>
                    <div className='flex justify-end'>
                        <button className='bg-red-500 text-white px-4 py-2 rounded-md'>حذف</button>
                    </div>
                </form>
            );
        }

        return (
            <div className='p-4'>
                <h2 className='text-lg font-semibold'>النموذج غير متوفر حالياً لهذا النوع: {table}</h2>
                {data && <p className='text-sm text-gray-500 mt-2'>تم تمرير بيانات وسيتم دعمها عند إضافة النموذج.</p>}
            </div>
        );
    };
    return (
        <>
        <button  className={`${size} flex items-center justify-center rounded-full ${bgColor}`}
        onClick={() => setOpen(true)}
        >
            <Image
                src={`/${type}.png`}
                alt='action-icon'
                width={16}
                height={16}
            />
                
             </button>
             {open && (
                <div className='w-screen h-screen bg-black fixed bg-opacity-60 left-0 top-0 z-50 flex items-center justify-center'>
                    <div className='bg-white p-4 rounded-lg relative w-[60%] md:w-[70%] lg:w-[50%] xl:w-[50%] 2xl:w-[40%]'>
                        <button className='absolute top-4 right-4 cursor-pointer text-red-500' onClick={() => setOpen(false)}>
                            <Image
                                src={`/close.png`}
                                alt='close'
                                width={17}
                                height={17}
                            />
                        </button>
                        <Form />
                    </div>
                </div>
             )}
        </>
    );
};

export default FormModel;
