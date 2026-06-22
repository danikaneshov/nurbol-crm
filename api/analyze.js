/* global process, Buffer */
// api/analyze.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageUrl, positions } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: 'Необходима ссылка на изображение' });
  }
  if (!positions || !Array.isArray(positions)) {
    return res.status(400).json({ error: 'Необходим список позиций (positions)' });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const imageResp = await fetch(imageUrl);
    if (!imageResp.ok) {
      throw new Error(`Не удалось скачать изображение: ${imageResp.status}`);
    }
    const arrayBuffer = await imageResp.arrayBuffer();
    
    const contentType = imageResp.headers.get('content-type') || 'image/jpeg';
    const mimeType = contentType.split(';')[0].trim();
    
    let positionsPrompt = "Твоя задача: найти количество проданных позиций из списка ниже по их ID и названию:\n";
    positions.forEach(p => {
      positionsPrompt += `- Ключ (ID): "${p.id}", Код в чеке: "${p.receiptId}", Название: "${p.receiptName}"\n`;
    });

    const exampleJson = positions.reduce((acc, p) => {
      acc[p.id] = 0;
      return acc;
    }, {});
    
    const prompt = `
      Ты — автоматизированный ассистент по учету продаж в заведении.
      
      Проанализируй фото отчета о закрытии смены (кассовый чек).
      
      ${positionsPrompt}
      
      Правила:
      1. Ищи КОЛИЧЕСТВО проданных штук (qty/кол-во), а не цену.
      2. Обязательно сверяй Код в чеке. Код часто находится слева от названия.
      3. Если позиция с таким кодом или названием не найдена — пиши 0.
      4. Не путай количество с ценой или номером позиции.
      5. Внимательно читай числа.
      
      ВЕРНИ ОТВЕТ СТРОГО В ФОРМАТЕ JSON, без Markdown, без комментариев.
      Ключами должны быть строго Ключ (ID) позиции.
      Пример ответа:
      ${JSON.stringify(exampleJson, null, 2)}
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: Buffer.from(arrayBuffer).toString("base64"),
          mimeType: mimeType,
        },
      },
    ]);

    const responseText = result.response.text();
    
    let parsedData = {};
    try {
      const cleanJsonString = responseText
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```/g, '')
        .trim();
      parsedData = JSON.parse(cleanJsonString);
    } catch {
      console.warn("Regex fallback for JSON parsing");
      // Fallback: very basic regex trying to find "key": number
      positions.forEach(p => {
        const regex = new RegExp(`"${p.id}"\\s*:\\s*(\\d+)`, 'i');
        const match = responseText.match(regex);
        if (match) {
          parsedData[p.id] = parseInt(match[1], 10);
        } else {
          parsedData[p.id] = 0;
        }
      });
    }

    // Ensure all positions exist in parsedData and are numbers
    positions.forEach(p => {
      parsedData[p.id] = Number(parsedData[p.id]) || 0;
    });

    res.status(200).json(parsedData);

  } catch (error) {
    console.error('Ошибка анализа Gemini:', error);
    res.status(500).json({ 
      error: "Ошибка при анализе фото искусственным интеллектом", 
      details: error.message 
    });
  }
}