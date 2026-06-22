import { useState } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useEmployee } from '../context/EmployeeContext';
import heic2any from 'heic2any';
import imageCompression from 'browser-image-compression';

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dl5vgfkvr/image/upload';
const UPLOAD_PRESET = 'ml_default';

export const useEmployeeData = () => {
 const { employee, currentShift, openModal, positions } = useEmployee();
 const [isUploading, setIsUploading] = useState(false);

 const uploadPhoto = async (file) => {
 try {
 let processedFile = file;

 if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
 const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
 processedFile = new File([convertedBlob], file.name.replace(/\.heic|\.heif/i, '.jpg'), { type: 'image/jpeg' });
 }

 const compressedFile = await imageCompression(processedFile, {
 maxSizeMB: 1,
 maxWidthOrHeight: 1920,
 useWebWorker: true
 });

 const formData = new FormData();
 formData.append('file', compressedFile);
 formData.append('upload_preset', UPLOAD_PRESET);

 const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
 if (!res.ok) {
 const errData = await res.json();
 throw new Error(errData?.error?.message || 'Network error during upload');
 }
 const data = await res.json();
 return data.secure_url;
 } catch (err) {
 console.error('Ошибка загрузки фото:', err);
 throw new Error('Не удалось загрузить фото. Проверьте формат и размер.');
 }
 };

 const handleOpenShift = async (partnerId, locationId) => {
 if (!employee) return;
 if (!locationId) {
 openModal('error', 'Ошибка', 'Выберите точку продаж!');
 return;
 }
 try {
 const d = new Date();
 if (d.getHours() < 6) d.setDate(d.getDate() - 1);
 const todayStr = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
 
 const snap = await getDocs(query(collection(db, 'sales'), where('dateStr', '==', todayStr), where('status', '==', 'open'), limit(1)));
 if (!snap.empty) {
 openModal('error', 'Ошибка', 'Смена уже открыта другим сотрудником.');
 return;
 }

 const shiftData = {
 dateStr: todayStr,
 locationId: locationId,
 employeeId: employee.id,
 employeeName: employee.name,
 partnerId: partnerId || '',
 status: 'open',
 items: {},
 staffHookahs: 0,
 earned: 0,
 createdAt: serverTimestamp()
 };
 await addDoc(collection(db, 'sales'), shiftData);
 } catch (err) {
 console.error('Ошибка открытия смены:', err);
 openModal('error', 'Ошибка', 'Не удалось открыть смену. Проверьте интернет.');
 }
 };

 const handleAddPartnerMidShift = async (partnerId) => {
 if (!currentShift || !partnerId) return;
 try {
 await updateDoc(doc(db, 'sales', currentShift.id), {
 partnerId: partnerId
 });
 openModal('success', 'Готово', 'Напарник успешно добавлен к текущей смене');
 } catch (err) {
 console.error('Ошибка добавления напарника:', err);
 openModal('error', 'Ошибка', 'Не удалось добавить напарника');
 }
 };

 const handleCloseShift = async (staffHookahs, photoFile) => {
 if (!currentShift || currentShift.status !== 'open') return;

 if (!photoFile) {
 openModal('error', 'Внимание', 'Фотография чека обязательна для закрытия смены!');
 return;
 }

 setIsUploading(true);
 let photoUrl = 'no-photo';
 
 try {
 // 1. Загружаем фото на Cloudinary
 photoUrl = await uploadPhoto(photoFile);
 if (!photoUrl) throw new Error("Не удалось получить ссылку на фото");

 // 2. Отправляем ИИ на анализ
 const aiRes = await fetch('/api/analyze', {
 method: 'POST', 
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ imageUrl: photoUrl, positions }),
 });
 
 if (!aiRes.ok) {
 const errorText = await aiRes.text();
 throw new Error(`Сервер ИИ недоступен: ${errorText}`);
 }
 
 const aiData = await aiRes.json();
 
 const totalItems = Object.values(aiData).reduce((a, b) => a + Number(b), 0);

 // 3. Если нули - требуем подтверждение
 if (totalItems === 0) {
 openModal('zeroConfirm', 'ИИ не нашёл позиций', 'Система распознала 0 продаж на чеке. Если продаж не было — продолжите. Иначе перефоткайте чек.', { 
 items: { ...aiData, staffHookahs }, 
 photoUrl 
 });
 setIsUploading(false);
 return;
 }

 // 4. Если всё найдено - закрываем
 await finalizeCloseShift(aiData, staffHookahs, photoUrl);

 } catch (err) {
 console.error("Ошибка закрытия смены:", err);
 openModal('error', 'Возникла проблема', err.message);
 setIsUploading(false);
 }
 };

  const confirmCloseShift = async (items, photoUrl) => {
  setIsUploading(true);
  try {
  const { staffHookahs, ...parsedItems } = items;
  await finalizeCloseShift(parsedItems.cocktail1, parsedItems.cocktail2, staffHookahs, photoUrl);
  } catch (err) {
  console.error(err);
  openModal('error', 'Ошибка', 'Не удалось закрыть нулевую смену.');
  } finally {
  setIsUploading(false);
  }
  };

  const finalizeCloseShift = async (itemsData, staffHookahs, photoUrl) => {
    const getBase = (val) => val !== undefined && val !== null && val !== '' ? Number(val) : 3000;
    let creatorBase = getBase(employee.baseSalary);
    let creatorSalesPercentage = Number(employee.salesPercentage) || 0;
    let creatorHookahPercentage = Number(employee.hookahPercentage) || 0;

    let partnerBase = 0;
    let partnerSalesPercentage = 0;
    let partnerHookahPercentage = 0;
    let partnerName = 'Напарник';

    // Calculate total sales from itemsData and positions
    let totalSales = 0;
    let totalItemsCount = 0;
    Object.keys(itemsData).forEach(posId => {
      const pos = positions.find(p => p.id === posId);
      const qty = Number(itemsData[posId]) || 0;
      if (pos) {
        totalSales += qty * Number(pos.price);
        totalItemsCount += qty;
      }
    });

    let creatorEarned = creatorBase;
    let partnerEarned = 0;

    if (currentShift.partnerId) {
      const partnerSnap = await getDocs(query(collection(db, 'employees'), where('__name__', '==', currentShift.partnerId)));
      if (!partnerSnap.empty) {
        const partnerData = partnerSnap.docs[0].data();
        partnerName = partnerData.name || 'Напарник';
        partnerSalesPercentage = Number(partnerData.salesPercentage) || 0;
        partnerHookahPercentage = Number(partnerData.hookahPercentage) || 0;
        partnerBase = getBase(partnerData.baseSalary);
      }
      
      const halfSales = totalSales / 2;
      const creatorItemsCount = Math.ceil(totalItemsCount / 2);
      const partnerItemsCount = Math.floor(totalItemsCount / 2);
      
      creatorEarned += (halfSales * (creatorSalesPercentage / 100)) + (creatorItemsCount * creatorHookahPercentage);
      partnerEarned = partnerBase + (halfSales * (partnerSalesPercentage / 100)) + (partnerItemsCount * partnerHookahPercentage);
    } else {
      creatorEarned += (totalSales * (creatorSalesPercentage / 100)) + (totalItemsCount * creatorHookahPercentage);
    }

    await updateDoc(doc(db, 'sales', currentShift.id), {
      status: 'closed',
      items: itemsData,
      staffHookahs: staffHookahs || 0,
      photoUrl: photoUrl,
      baseSalary: creatorBase,
      earned: creatorEarned,
      totalSales: totalSales,
      shiftFraction: currentShift.partnerId ? 0.5 : 1,
      closedAt: serverTimestamp()
    });

    if (currentShift.partnerId) {
      await addDoc(collection(db, 'sales'), {
        dateStr: currentShift.dateStr,
        locationId: currentShift.locationId || '',
        employeeId: currentShift.partnerId,
        employeeName: partnerName,
        partnerId: employee.id,
        status: 'closed',
        items: itemsData,
        staffHookahs: staffHookahs || 0,
        photoUrl: photoUrl,
        baseSalary: partnerBase,
        earned: partnerEarned,
        totalSales: totalSales,
        shiftFraction: 0.5,
        closedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
    }

    openModal('success', 'Смена закрыта!', `Распознано: ${totalItemsCount} позиций на сумму ${totalSales} ₸. Ваш заработок: ${Math.round(creatorEarned)} ₸`);
    setIsUploading(false);
  };

 return {
 handleOpenShift,
 handleCloseShift,
 confirmCloseShift,
 handleAddPartnerMidShift,
 isUploading
 };
};
