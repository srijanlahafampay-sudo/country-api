const express = require("express");
const axios = require("axios");
const cors = require("cors");
const moment = require("moment-timezone");

const app = express();
app.use(cors());
app.use(express.json());

// Cache (simple)
let CACHE = {
    countries: null,
    timestamp: 0
};

async function getCountries() {
    const now = Date.now();

    // Cache for 1 hour
    if (CACHE.countries && now - CACHE.timestamp < 3600000) {
        return CACHE.countries;
    }

    const REST = "https://restcountries.com/v3.1/all";
    const POP = "https://countriesnow.space/api/v0.1/countries/population";

    const [rest, pop] = await Promise.all([
        axios.get(REST),
        axios.get(POP).catch(() => ({ data: { data: [] } }))
    ]);

    const popList = pop.data.data || [];

    const combined = rest.data.map(c => {
        const match = popList.find(
            p => p.country.toLowerCase() === c.name.common.toLowerCase()
        );

        const population = match
            ? match.populationCounts.at(-1).value
            : c.population || null;

        return {
            name: c.name,
            cca2: c.cca2,
            cca3: c.cca3,
            region: c.region,
            capital: c.capital,
            timezones: c.timezones,
            area: c.area,
            flags: c.flags,
            maps: c.maps,
            currencies: c.currencies,
            population
        };
    });

    CACHE = {
        countries: combined,
        timestamp: now
    };

    return combined;
}

async function findCountry(name) {
    const list = await getCountries();
    const lower = name.toLowerCase();
    return list.find(c =>
        c.name.common.toLowerCase() === lower ||
        c.cca2?.toLowerCase() === lower ||
        c.cca3?.toLowerCase() === lower
    );
}

// --------------------------------------------
// ROUTES
// --------------------------------------------

// GET /countries
app.get("/countries", async (req, res) => {
    res.json(await getCountries());
});

// GET /country/:name
app.get("/country/:name", async (req, res) => {
    const c = await findCountry(req.params.name);
    if (!c) return res.status(404).json({ error: "Country not found" });
    res.json(c);
});

// GET /time/:name
app.get("/time/:name", async (req, res) => {
    const c = await findCountry(req.params.name);
    if (!c) return res.status(404).json({ error: "Country not found" });

    const tz = c.timezones?.[0] || "UTC";
    const time = moment().tz(tz).format("YYYY-MM-DD HH:mm:ss");

    res.json({ country: c.name.common, timezone: tz, time });
});

// GET /compare?A=india&B=japan
app.get("/compare", async (req, res) => {
    const A = await findCountry(req.query.A);
    const B = await findCountry(req.query.B);
    if (!A || !B) return res.status(404).json({ error: "Invalid countries" });
    res.json({ A, B });
});

// GET /random
app.get("/random", async (req, res) => {
    const list = await getCountries();
    res.json(list[Math.floor(Math.random() * list.length)]);
});

// --------------------------------------------

app.get("/", (req, res) => {
    res.send("Country API is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API running on " + PORT));
