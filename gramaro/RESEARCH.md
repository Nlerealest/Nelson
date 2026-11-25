# Gramaro Travel Agency: research for the mobile app

What Gramaro does, how a Malawian travel agency like it works day to day, the problems customers and staff run into, and how the app answers each one.

## 1. What we know about Gramaro

From the signboard (Zomba, next to Freshwater Project International):

| | |
| --- | --- |
| **Services** | Flight bookings · affordable air tickets · international & domestic travel assistance · travel planning & support · special deals & seasonal offers |
| **Promise** | "Reliable & top notch customer service" |
| **Contact** | 0884 099 227 · 0881 737 157 · 099 925 349 (Airtel and TNM numbers, with a WhatsApp icon) |
| **Online presence** | None found. A web search for "Gramaro Travel Agency" returns nothing, and it is not in the Malawi directories we checked. Customers can only find and reach them through the sign, word of mouth, phone calls and WhatsApp. |

Before launch, confirm with Gramaro: their real payment numbers and bank account, which staff will use the app, their dollar selling rate, and whether they are a Travel Agents Association of Malawi (TAAM) member or IATA-accredited (this decides whether they issue tickets themselves or through a consolidator).

## 2. How their system works today (and how the app copies it)

A small agency in Malawi typically works like this. The app follows the same steps, so staff don't have to change how they work. They just do it in one place, and the customer sees each step live.

| # | Today | In the app (`requests.status`) |
| --- | --- | --- |
| 1 | The customer walks in, calls one of 3 numbers, or sends a WhatsApp: "Lilongwe to Dubai, 18 Dec, 2 adults and a child". | Customer fills in **Book**. The request appears instantly on every staff phone (`new`). |
| 2 | An agent searches fares on a GDS (Amadeus/Galileo/Sabre) or on the airline agent portals: Ethiopian, Kenya Airways, Airlink, Malawi Airlines, Qatar, Emirates… | Agent taps **Take it**. Customer sees "Finding fares" (`quoting`). |
| 3 | The agent puts seats **on hold** (a PNR). The airline sets a **ticketing time limit**: if the ticket isn't issued by then, the seats are cancelled and the price can change. Fares are priced in **US dollars**. | Agent adds 1–3 **fare options** with airline, route, times, baggage, US$ and MK price, and **how long the airline holds it**. Customer sees them at once, with a live countdown (`quoted`). |
| 4 | The agent calls or WhatsApps the customer with prices, often several times. | Customer compares and taps **Choose this fare**. Expired fares can't be chosen (`accepted`). |
| 5 | The customer pays in cash at the office, by bank deposit, or by Airtel Money / TNM Mpamba, then sends a photo of the slip or the SMS. Often in instalments. | Customer taps **I have paid**: method, amount, transaction ID. Part payments are allowed (`paid`). |
| 6 | Staff check the statement and confirm the money arrived. | Staff tap **Money received** or **Not received** (with a reason). When the total is covered, the trip moves on automatically (`confirmed`). |
| 7 | The agent issues the e-ticket and sends it by WhatsApp or email. | Agent enters the PNR and e-ticket numbers and taps **Mark as ticketed**. The customer's app shows the booking reference in big letters (`ticketed`). |
| 8 | Questions, changes and reminders go through phone calls and WhatsApp. | Each trip has its own **chat** and **timeline** that both sides see live. |

## 3. Problems an app can solve

### Customers

1. **Hard to reach, only during office hours.** Three phone numbers and walk-ins only, and no web presence. → Send a request any time, from anywhere in Malawi or abroad. Call/WhatsApp buttons are still one tap away.
2. **No visibility on what's happening.** "Did they find a fare? Did my money arrive?" means calling again. → A live five-step progress bar, a timeline and in-app banners when anything changes.
3. **Prices change and holds expire.** Airline holds have strict time limits, and the price guarantee can end even before that. → Every fare shows **exactly how long it's held** with a countdown. Expired fares are locked, and staff see a "fare holds running out" list.
4. **Forex shortages and kwacha devaluation.** Airlines price in dollars. Malawi has repeated forex shortages: in 2022–2023 Ethiopian, Kenya Airways and SAA suspended kwacha ticket sales, and in 2026 travellers still report banks refusing to sell dollars, plus a US$1,000 cash-holding limit. → Fares are shown in **MK and US$**. Gramaro's **dollar rate** is published live on the home screen, so prices are transparent, and customers are pushed to pay before the hold ends so the agency isn't caught by a rate move.
5. **Paying is clumsy and hard to prove.** People send screenshots of Airtel Money/Mpamba SMS on WhatsApp, which get lost. → Pay by Airtel Money, Mpamba, bank or cash, type the transaction ID once, and see "Checking → Confirmed" live. **Instalments** are built in (deposit now, balance later), which suits how many Malawians save up for tickets.
6. **Passport and visa surprises.** Most countries and airlines refuse passports with less than 6 months left. Malawi's visa rules changed several times in 2026 (requirements reinstated in January, an e-Visa that must be printed). → The profile stores passport expiry and warns automatically against the travel date. There's a **Visa help** request type and a "Before you fly" checklist.
7. **Deals don't reach people.** "Special deals & seasonal offers" are only on a signboard. → Staff publish deals that appear on every customer's home screen instantly. Tapping one starts a request.

### Staff / the agency

8. **Requests scattered across 3 phones and WhatsApp chats.** Nobody knows who is handling what. → One shared inbox with filters (New, Waiting on customer, Check payment, To ticket…), **Take it** assignment, and unread-message counts.
9. **Re-typing the same information.** Names, phone numbers, passport details. → The customer's profile (name as on passport, phone, passport number and expiry) is attached to every request.
10. **Reconciling payments.** Matching SMS screenshots to customers. → A **Payments** tab lists every reported payment with method, amount and transaction ID, plus today's confirmed total.
11. **Fare holds lapsing unnoticed.** The agency loses the seat or has to re-quote at a higher price. → The **Today** dashboard lists holds running out in the next 6 hours, with the customer's phone number.
12. **No records.** Paper and chat history only. → Every request, fare, payment and message is stored with a timeline and a reference (GT-XXXXXX), and is searchable by name, phone, reference, PNR or city.

## 4. "Real time": how it works

- **Supabase** (hosted Postgres + login + Realtime) is the backend, the same setup Twizzy already uses in this repository. The free plan is enough to start.
- Every table is published to **Supabase Realtime**. The app opens one live connection and applies each insert/update the moment it happens. A fare an agent sends appears on the customer's phone within about a second, with no refresh.
- Database **row-level security** makes sure each customer only ever receives their own trips, while staff (emails in the `staff` table) receive everything.
- Money and status rules live in the database (`accept_quote`, `submit_payment`, triggers), so a customer can't change a price, mark their own payment as confirmed, or choose an expired fare. These rules were tested against a real Postgres 16 database.
- When the phone wakes up or the app comes back to the front, it reloads to catch anything missed.

## 5. Next steps (phase 2)

1. **Push notifications** when the app is closed. This needs Firebase (FCM) set up for Android plus a database webhook to the Expo push service.
2. **Automatic mobile money collection** through a Malawian payment gateway (for example PayChangu, which supports Airtel Money and TNM Mpamba), so payments confirm themselves instead of staff checking statements.
3. **Upload passport photos and documents** (Supabase Storage) for visa applications.
4. **Live fare search** through a GDS or flight API (Amadeus Self-Service, Duffel). This needs Gramaro's IATA/consolidator agreements.
5. **Flight change alerts** (schedule changes, cancellations) and a check-in reminder 24 hours before departure.
6. **Chichewa** language option.
7. **Phone-number sign-in** (SMS OTP) instead of email, since many customers use phones more than email.

## Sources

- [Flights cancelled in Malawi over forex crisis (Nyasa Times)](https://www.nyasatimes.com/flights-cancelled-in-malawi-over-forex-crisis/)
- [SAA halts sales in Malawi (Travel News)](https://www.travelnews.co.za/article/saa-halts-sales-in-malawi)
- [South African Airways suspend air ticket sales in Malawi (Malawi24)](https://malawi24.com/2023/11/10/devaluation-effects-south-african-airways-suspend-air-ticket-sales-in-malawi/)
- [Malawi faces shortages of foreign exchange (VOA)](https://www.voazimbabwe.com/a/6585041.html)
- [Malawians still crippled by forex shortages, Sept 2026 (Africa Pulse)](https://www.africapulse.com/2026/09/15/malawi-malawians-still-crippled-by-forex-shortages-as-banks-refuse-to-budge/)
- [Malawi US$1,000 forex limit (Travel And Tour World)](https://www.travelandtourworld.com/news/article/lat4jgcaew1n/)
- [Malawi e-Visa portal: public notice 2026](https://evisa.gov.mw/) and [FAQ](https://evisa.gov.mw/Faq)
- [Visa on arrival / 2026 changes (Visas News)](https://visasnews.com/en/malawi-visa-on-arrival-remains-available-to-travelers-from-160-countries/)
- [Malawi visa issue resolved, March 2026 (Scotland Malawi Partnership)](https://www.scotland-malawipartnership.org/news/malawi-visa-issue-resolved-for-british-passport-holders)
- [Ticketing time limits (Finnair)](https://easy.finnair.com/en/reservation---ticketing/ticketing/ticketing-time-limits) and [Qatar Airways trade booking & ticketing](https://www.qatarairways.com/tradeportal/en/bookingnticketing.html)
- [Bamboo Airways booking policy (churning, same-GDS ticketing)](https://bambooairways.com/documents/d/global/policy)
- [Lilongwe routes (FlightsFrom)](https://www.flightsfrom.com/LLW/destinations), [Malawi Airlines boosts domestic schedule (AirlineGeeks)](https://airlinegeeks.com/2025/04/11/malawi-airlines-boosts-domestic-schedule/), [Ethiopian flights from Malawi](https://www.ethiopianairlines.com/en-mw/flights-from-malawi)
- [Mpamba used for bus tickets (ITWeb)](https://itweb.africa/amp/content/O2rQGqAn5XRvd1ea/LPp6V7r4yEZqDKQz), [Malawi arrival, money & essentials](https://visiearth.pages.dev/mw/arrival-money-and-essentials/), [Airtel Money limits (WorldRemit)](https://www.worldremit.com/en/malawi/mobile-money)
- [Travel Agents Association of Malawi](http://travelagentsassociationmw.com/about)
