import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import UserModel from "./models/user_model";
import PostModel from "./models/post_model";
import { generateEmbeddings, generateImageSemanticContext, ImageEmbeddingInput } from "./services/ai_service";

dotenv.config();

type SeedPost = {
    title: string;
    content: string;
};

type FlickrFeedItem = {
    media?: {
        m?: string;
    };
};

const IMAGE_QUERY_BY_TITLE: Record<string, string> = {
    "Golden Hour in Santorini": "santorini,greece,sunset,caldera",
    "Kyoto Lantern Walk": "kyoto,japan,lantern,temple,night",
    "Alpine Lake Escape": "alpine,lake,mountain,sunrise",
    "Lisbon Tram Mornings": "lisbon,tram,portugal,street",
    "Road Trip Through Patagonia": "patagonia,road,mountains,glacier",
    "Sunrise Over Cappadocia": "cappadocia,balloons,sunrise,turkey",
    "Tokyo Street Food Adventure": "tokyo,street,food,japan,market",
    "Northern Lights in Iceland": "iceland,northernlights,aurora,night",
    "Marrakesh Market Maze": "marrakesh,market,souk,morocco",
    "Hiking the Dolomites": "dolomites,hiking,mountains,italy",
    "Seoul Night Cafes": "seoul,night,city,street,cafe",
    "Snorkeling in Belize": "belize,snorkeling,reef,ocean",
    "Safari in Tanzania": "tanzania,safari,wildlife,africa",
    "Beach Paradise in Maldives": "maldives,beach,ocean,tropical",
    "Amsterdam Canal Tour": "amsterdam,canal,netherlands,city",
    "Weekend in Prague": "prague,oldtown,czech,city",
    "Desert Camp in Wadi Rum": "wadirum,desert,jordan,dunes",
    "Kayaking in Ha Long Bay": "halongbay,kayak,vietnam,limestone",
    "Rainforest Trails in Costa Rica": "costarica,rainforest,jungle,trail",
    "Sailing the Greek Islands": "greece,islands,sailing,sea",
    "Cultural Weekend in Mexico City": "mexicocity,historic,culture,street",
    "Autumn Colors in Quebec": "quebec,autumn,forest,fall",
    "Temple Run in Bagan": "bagan,temples,myanmar,sunrise",
    "Train Ride Across Switzerland": "switzerland,train,alps,scenic",
    "Cliffside Villages in Cinque Terre": "cinqueterre,italy,coast,village",
    "Camping in Banff": "banff,camping,lake,mountains",
    "48 Hours in New York": "newyork,city,skyline,street",
    "Island Loop in Sri Lanka": "srilanka,island,train,tea",
    "Old Souks of Muscat": "muscat,oman,souk,market",
    "Diving in the Red Sea": "redsea,diving,coral,reef",
    "Hidden Cafes in Paris": "paris,cafe,street,france",
    "Waterfalls of Madeira": "madeira,waterfall,trail,portugal",
    "Surf Week in Portugal": "portugal,surf,beach,waves",
    "Ancient Ruins of Petra": "petra,jordan,ruins,archaeology",
    "City Lights of Hong Kong": "hongkong,skyline,harbor,night",
    "Winter Weekend in Vienna": "vienna,winter,city,austria",
    "Sunset at Tel Aviv Beach": "telaviv,israel,beach,sunset,mediterranean",
    "Hike in Ein Gedi Oasis": "eingedi,israel,desert,oasis,hiking,deadsea"
};

const buildAvatarUrl = (variant = 1): string => `https://i.pravatar.cc/240?img=${variant}`;

const buildFallbackImageUrl = (seed: string): string => {
    return `https://picsum.photos/seed/${encodeURIComponent(seed)}/1280/840`;
};

const toLargeFlickrUrl = (rawUrl: string): string => {
    return rawUrl.replace("_m.", "_b.");
};

const fetchFlickrImages = async (query: string, count: number): Promise<string[]> => {
    const endpoint = `https://www.flickr.com/services/feeds/photos_public.gne?format=json&nojsoncallback=1&tags=${encodeURIComponent(query)}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
        throw new Error(`Flickr request failed with status ${response.status}`);
    }

    const data = (await response.json()) as { items?: FlickrFeedItem[] };
    const urls = (data.items ?? [])
        .map((item) => item.media?.m)
        .filter((url): url is string => Boolean(url))
        .map((url) => toLargeFlickrUrl(url));

    return [...new Set(urls)].slice(0, count);
};

const buildTravelImagesForPost = async (title: string, variantBase: number): Promise<string[]> => {
    const query = IMAGE_QUERY_BY_TITLE[title] ?? "travel,landscape,destination";

    try {
        const images = await fetchFlickrImages(query, 2);
        if (images.length >= 2) {
            return images;
        }
        if (images.length === 1) {
            return [images[0], buildFallbackImageUrl(`${title}-${variantBase + 1}`)];
        }
    } catch {
        // Fallback to stable deterministic images if external feed is unavailable.
    }

    return [
        buildFallbackImageUrl(`${title}-${variantBase}`),
        buildFallbackImageUrl(`${title}-${variantBase + 1}`)
    ];
};

let imageVisionCallsUsed = 0;
const MAX_IMAGE_VISION_CALLS_PER_SEED = Math.max(
    0,
    parseInt(process.env.SEED_MAX_IMAGE_VISION_CALLS || "4", 10)
);

const fallbackImageContextFromTitle = (title: string): string => {
    const query = IMAGE_QUERY_BY_TITLE[title] ?? "travel,landscape,destination";
    return query
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .join(", ");
};

const buildImageInputsFromUrls = async (imageUrls: string[]): Promise<ImageEmbeddingInput[]> => {
    // Keep external API usage controlled during seeding.
    const selected = imageUrls.slice(0, 1);

    const fetched = await Promise.all(
        selected.map(async (url) => {
            try {
                const response = await fetch(url);
                if (!response.ok) return null;

                const contentType = response.headers.get("content-type") || "image/jpeg";
                if (!contentType.startsWith("image/")) return null;

                const buffer = Buffer.from(await response.arrayBuffer());
                return {
                    mimeType: contentType.split(";")[0].trim(),
                    data: buffer,
                } as ImageEmbeddingInput;
            } catch {
                return null;
            }
        })
    );

    return fetched.filter((item): item is ImageEmbeddingInput => item !== null);
};

const buildImageSemanticSeedContext = async (title: string, imageUrls: string[]): Promise<string> => {
    const fallbackContext = fallbackImageContextFromTitle(title);

    if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_API_KEY.trim()) {
        return fallbackContext;
    }

    if (imageVisionCallsUsed >= MAX_IMAGE_VISION_CALLS_PER_SEED) {
        return fallbackContext;
    }

    const imageInputs = await buildImageInputsFromUrls(imageUrls);
    if (imageInputs.length === 0) return fallbackContext;

    imageVisionCallsUsed += 1;
    const semanticContext = await generateImageSemanticContext(imageInputs);
    return semanticContext || fallbackContext;
};

const seedData = async () => {
    try {
        await mongoose.connect(process.env.DATABASE_URL as string);
        console.log("Connected to MongoDB");

        await UserModel.deleteMany({});
        await PostModel.deleteMany({});
        console.log("Cleared existing data");

        const hashedPassword = await bcrypt.hash("password123", 10);

        const users = await UserModel.create([
            {
                username: "traveler_alex",
                email: "alex@example.com",
                password: hashedPassword,
                profilePic: buildAvatarUrl(12),
                refreshToken: []
            },
            {
                username: "wanderlust_sam",
                email: "sam@example.com",
                password: hashedPassword,
                profilePic: buildAvatarUrl(18),
                refreshToken: []
            },
            {
                username: "explorer_jordan",
                email: "jordan@example.com",
                password: hashedPassword,
                profilePic: buildAvatarUrl(25),
                refreshToken: []
            },
            {
                username: "nomad_maya",
                email: "maya@example.com",
                password: hashedPassword,
                profilePic: buildAvatarUrl(33),
                refreshToken: []
            },
            {
                username: "captain_lee",
                email: "lee@example.com",
                password: hashedPassword,
                profilePic: buildAvatarUrl(42),
                refreshToken: []
            },
            {
                username: "urban_zoe",
                email: "zoe@example.com",
                password: hashedPassword,
                profilePic: buildAvatarUrl(56),
                refreshToken: []
            }
        ]);

        console.log(`Created ${users.length} users`);

        const postLibraryByUser: SeedPost[][] = [
            [
                { title: "Golden Hour in Santorini", content: "Whitewashed cliffs, blue domes, and a sunset that made time stop. The view from Oia was absolutely breathtaking." },
                { title: "Kyoto Lantern Walk", content: "Quiet alleys, warm lantern glow, and a matcha break by the river. The temples here feel timeless and calm." },
                { title: "Alpine Lake Escape", content: "Crystal water, pine air, and a sunrise hike with panoramic peaks. The silence in the mountains was unforgettable." },
                { title: "Lisbon Tram Mornings", content: "Pastel facades, steep streets, and fresh pastries before hopping tram 28. Every corner looked like a postcard." },
                { title: "Road Trip Through Patagonia", content: "Windy roads, glaciers, and guanacos by the highway. We drove for hours and never got bored of the scenery." },
                { title: "Sunrise Over Cappadocia", content: "Hot air balloons floating above fairy chimneys while the sky turned pink. One of the best mornings of my life." },
                { title: "Sunset at Tel Aviv Beach", content: "Golden light on the Mediterranean, beach volleyball, and a lively promenade full of runners and cyclists." },
                { title: "Hike in Ein Gedi Oasis", content: "Desert cliffs, cool spring pools, and ibex sightings on a trail that overlooks the Dead Sea." }
            ],
            [
                { title: "Tokyo Street Food Adventure", content: "From ramen to takoyaki, every bite was incredible. The energy in Shibuya at night is unmatched." },
                { title: "Northern Lights in Iceland", content: "Dancing green lights across the sky. Worth every freezing minute and every layer we packed." },
                { title: "Marrakesh Market Maze", content: "Spices, lanterns, and hidden courtyards around every turn. Bargaining with local artisans was half the fun." },
                { title: "Hiking the Dolomites", content: "Sharp peaks, alpine huts, and the clearest mountain air. We ended each day with pasta and sunset views." },
                { title: "Seoul Night Cafes", content: "Late-night cafes, neon streets, and perfect iced coffee even in winter. The city never really sleeps." },
                { title: "Snorkeling in Belize", content: "Colorful reefs, nurse sharks, and crystal water visibility. The marine life around the barrier reef blew us away." }
            ],
            [
                { title: "Safari in Tanzania", content: "Witnessed the great migration and saw lions, elephants, and giraffes in their natural habitat." },
                { title: "Beach Paradise in Maldives", content: "Clear water, overwater bungalows, and coral reefs full of life. Slow mornings and sunsets were the routine." },
                { title: "Amsterdam Canal Tour", content: "Cycling through the city, exploring museums, and cruising the canals. Such a charming and artistic vibe." },
                { title: "Weekend in Prague", content: "Cobblestone alleys, gothic towers, and riverside jazz bars. The old town looked magical after dark." },
                { title: "Desert Camp in Wadi Rum", content: "Red sand dunes, jeep rides, and a star-filled night sky so bright we barely needed flashlights." },
                { title: "Kayaking in Ha Long Bay", content: "We paddled between limestone karsts and floating villages while mist rolled over the water. Surreal scenery." }
            ],
            [
                { title: "Rainforest Trails in Costa Rica", content: "Howler monkeys, hanging bridges, and sudden tropical rain. Every trail felt alive and full of sound." },
                { title: "Sailing the Greek Islands", content: "Small harbors, blue water, and late dinners by the sea. Island hopping by sailboat was pure freedom." },
                { title: "Cultural Weekend in Mexico City", content: "Street tacos, Frida Kahlo museum, and long walks in Coyoacan. Rich history and incredible food culture." },
                { title: "Autumn Colors in Quebec", content: "Maple forests turning red and orange made every drive spectacular. The crisp air was perfect for hiking." },
                { title: "Temple Run in Bagan", content: "Thousands of ancient temples scattered across open plains. Sunrise from the viewing hill was unforgettable." },
                { title: "Train Ride Across Switzerland", content: "Glacier views through panoramic windows and tiny villages along the route. Public transport here is next level." }
            ],
            [
                { title: "Cliffside Villages in Cinque Terre", content: "Colorful houses, steep stairs, and seaside trails connecting each village. We rewarded ourselves with gelato." },
                { title: "Camping in Banff", content: "Turquoise lakes, elk sightings, and chilly campfire nights. Waking up surrounded by mountains felt unreal." },
                { title: "48 Hours in New York", content: "Rooftop views, Broadway lights, and coffee-fueled walks through different neighborhoods. Fast, loud, and iconic." },
                { title: "Island Loop in Sri Lanka", content: "Tea plantations, surf towns, and wildlife parks in one trip. The train through Ella was a highlight." },
                { title: "Old Souks of Muscat", content: "Frankincense scents, silver crafts, and warm hospitality. The evening corniche walk was beautifully calm." },
                { title: "Diving in the Red Sea", content: "Wall dives, vibrant coral, and schools of fish in every direction. Visibility was amazing all week." }
            ],
            [
                { title: "Hidden Cafes in Paris", content: "Croissants, tiny bookstores, and rainy afternoon people-watching. We found new favorites in side streets." },
                { title: "Waterfalls of Madeira", content: "Levada hikes through green valleys led to dramatic waterfalls and endless Atlantic views." },
                { title: "Surf Week in Portugal", content: "Beginner-friendly waves, sandy beaches, and seafood dinners after sunset sessions." },
                { title: "Ancient Ruins of Petra", content: "Walking through the Siq and seeing the Treasury appear was a goosebump moment." },
                { title: "City Lights of Hong Kong", content: "Harbor skyline, mountain trams, and dim sum mornings. Dense, dramatic, and incredibly photogenic." },
                { title: "Winter Weekend in Vienna", content: "Classical concerts, coffee houses, and Christmas market lights across the old city." }
            ]
        ];

        const posts = await Promise.all(
            postLibraryByUser.flatMap((userPosts, userIndex) =>
                userPosts.map(async (post, postIndex) => {
                    const imageBaseIndex = postIndex * 2 + userIndex * 7;
                    return {
                        title: post.title,
                        content: post.content,
                        images: await buildTravelImagesForPost(post.title, imageBaseIndex),
                        userId: users[userIndex]._id
                    };
                })
            )
        );

        const postsWithVectors: Array<typeof posts[number] & { vector: number[] }> = [];
        for (const post of posts) {
            const imageContext = await buildImageSemanticSeedContext(post.title, post.images);
            const textForEmbedding = [
                post.title,
                post.content,
                imageContext ? `Image context: ${imageContext}` : ""
            ]
                .filter(Boolean)
                .join(" - ");

            postsWithVectors.push({
                ...post,
                vector: await generateEmbeddings(textForEmbedding)
            });
        }

        await PostModel.create(postsWithVectors);
        console.log(`Created ${posts.length} posts`);
        console.log(`Image vision calls used: ${imageVisionCallsUsed}/${MAX_IMAGE_VISION_CALLS_PER_SEED}`);

        console.log("\n✅ Seed data created successfully!");
        console.log("\nSample credentials:");
        console.log("Email: alex@example.com");
        console.log("Email: sam@example.com");
        console.log("Email: jordan@example.com");
        console.log("Email: maya@example.com");
        console.log("Email: lee@example.com");
        console.log("Email: zoe@example.com");
        console.log("Password: password123");

        process.exit(0);
    } catch (error) {
        console.error("Error seeding data:", error);
        process.exit(1);
    }
};

seedData();
