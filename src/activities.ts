import puppeteer from 'puppeteer';
import 'dotenv/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import z from 'zod';

const AuctionFormat = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      soldPrice: z.string(),
      sourceURL: z.string(),
      confidenceScore: z.number().min(0).max(100),
    }),
  ),
});

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

export async function scrape(text: string) {
  const response = await client.chat.completions.create({
    model: 'gpt-5-chat-latest',
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: `Gör om texten till en kortare sammanfattning. Formatera i den här stilen: [TYP / HUVUDKATEGORI]: [KONSTNÄR / TILLVERKARE / MÄRKE] – [BESKRIVNING / MOTIV / MODELL] ([MATERIAL / TEKNIK / TIDSPERIOD / LAND])
Delar och regler:
Fält	Beskrivning	Exempel
TYP / HUVUDKATEGORI	Övergripande kategori, t.ex. Målning, Vas, Soffa, Ring, Armbandsur	Litografi, Vas, Soffa
KONSTNÄR / TILLVERKARE / MÄRKE	Namn på konstnär, designer eller varumärke	Lennart Rodhe, Orrefors, Bang & Olufsen
BESKRIVNING / MOTIV / MODELL	Motiv, serie, titel, eller typbeskrivning	Komposition, "Herrgården", Vy från terrass
MATERIAL / TEKNIK / TIDSPERIOD / LAND	Valfritt tillägg som förtydligar, t.ex. olja på duk, 1900-tal, Danmark	(olja på duk, 1980), (glas, 1970-tal, Sverige)

Exempel på hur formaten tillämpas:
Originaltitel	Standardiserad titel
LENNART RODHE. Komposition, litografi, signerad och numrerad 119/220, daterad 1980.	Litografi: Lennart Rodhe – Komposition (1980)
VAS, Orrefors.	Vas: Orrefors (glas)
REKLAMSKYLT, von Bergens Carlshamns Punsch, tidigt 1900-tal.	Reklamskylt: von Bergens – Carlshamns Punsch (tidigt 1900-tal)
DIAMANTRING 18K, ca 0,65 carat.	Ring: Diamantring 18K (ca 0,65 ct)
BORD, med öländsk kalkstensskiva, gustaviansk stil 1990-tal.	Bord: Gustaviansk stil med öländsk kalkstensskiva (1990-tal)
TISSOT, armbandsur, cal 27B-21, manuell, 1950-tal, stål.	Armbandsur: Tissot – Cal 27B-21, manuell (stål, 1950-tal)
CARL MALMSTEN. Skänk, "Herrgården", Bodafors, vitlackerat trä, brännstämplad, 1900-talets andra hälft.	Skänk: Carl Malmsten – "Herrgården" (Bodafors, vitlackerat trä, 1900-talets andra hälft)
BEOSOUND "Overture" Bang & Olufsen.	Stereoanläggning: Bang & Olufsen – Beosound "Overture"

💡 Kortare variant (om du vill ha enklare titlar):
less
Kopiera kod
[KATEGORI]: [NAMN / TILLVERKARE] – [BESKRIVNING / ÅRTAL]
Exempel:

Litografi: Lennart Rodhe – Komposition (1980)

Vas: Orrefors (1900-tal)

Ring: 18K, diamanter (0,65 ct)

Soffa: Gustaviansk stil (1900-tal)

Karaff: Elis Bergh – Kosta Boda (signerad)`,
          },
        ],
      },
      {
        role: 'user',
        content: `Help me value this item: ${text}`,
      },
    ],
  });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  });

  const query = response.choices[0].message.content;

  await page.goto(`https://auctionet.com/sv/search?event_id=&is=ended&q=${query}`, {
    waitUntil: 'networkidle2',
  });

  // Extract id, title, and price
  const items = await page.evaluate(() => {
    const articles = Array.from(document.querySelectorAll('article.test-thumb'));
    return articles.map((article) => {
      const titleEl = article.querySelector('span.test-item-title');
      const priceEl = article.querySelector('div.test-item-amount div[style] div');

      // Extract id from the title attribute (first number before a dot)
      const fullTitle = titleEl?.getAttribute('title') || '';
      const idFromTitle = fullTitle.split('.')[0];
      const titleWithoutId = fullTitle.split('.').slice(1).join('.').trim();

      const price = priceEl?.textContent?.trim().replace(/\u00a0/g, ' ') || '';

      return {
        sourceUrl: 'https://auctionet.com/sv/' + idFromTitle,
        title: titleWithoutId,
        price,
      };
    });
  });

  await browser.close();

  return items;
}

export async function askLLM(text: string, scrapedItems: { sourceUrl: string; title: string; price: string }[]) {
  const result = await client.responses.parse({
    model: 'gpt-5-chat-latest',
    input: [
      {
        role: 'system',
        content:
          'You are an expert auction appraiser specialized in art and design items sold on https://www.auctionet.com. You have access to web search tools to find recent auction results for similar items. Answer in Swedish. Answer with an array of at least 3 objects in the specified format. Answer with a confidence score of how sure you are that the results are relevant to the item described by the user. If you are not able to find any relevant auction results, return an empty array. The sourceURL field should contain a link to the auction result page. Then compare with the scraped items and only include those that are relevant. SCRAPED ITEMS: ' +
          JSON.stringify(scrapedItems),
      },
      {
        role: 'user',
        content: `Help me value this item: ${text}`,
      },
    ],
    tools: [
      {
        type: 'web_search',
      },
    ],
    text: {
      format: zodTextFormat(AuctionFormat, 'auction'),
    },
  });

  return result.output_parsed;
}
