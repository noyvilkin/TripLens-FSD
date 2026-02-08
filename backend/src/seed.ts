import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import UserModel from "./models/user_model";
import PostModel from "./models/post_model";
import { generateEmbeddings } from "./services/ai_service";

dotenv.config();

const seedData = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.DATABASE_URL as string);
        console.log("Connected to MongoDB");

        // Clear existing data
        await UserModel.deleteMany({});
        await PostModel.deleteMany({});
        console.log("Cleared existing data");

        // Create sample users
        const hashedPassword = await bcrypt.hash("password123", 10);
        
        const users = await UserModel.create([
            {
                username: "traveler_alex",
                email: "alex@example.com",
                password: hashedPassword,
                profilePic: "",
                refreshToken: []
            },
            {
                username: "wanderlust_sam",
                email: "sam@example.com",
                password: hashedPassword,
                profilePic: "",
                refreshToken: []
            },
            {
                username: "explorer_jordan",
                email: "jordan@example.com",
                password: hashedPassword,
                profilePic: "",
                refreshToken: []
            }
        ]);

        console.log(`Created ${users.length} users`);

        // Create sample posts for each user
        const posts = [];
        
        // Posts for user 1 (alex)
        posts.push(
            {
                title: "Golden Hour in Santorini",
                content: "Whitewashed cliffs, blue domes, and a sunset that made time stop. The view from Oia was absolutely breathtaking!",
                userId: users[0]._id
            },
            {
                title: "Kyoto Lantern Walk",
                content: "Quiet alleys, warm lantern glow, and a matcha break by the river. The temples here are so peaceful.",
                userId: users[0]._id
            },
            {
                title: "Alpine Lake Escape",
                content: "Crystal water, pine air, and a sunrise hike with a view. Nothing beats waking up to mountain peaks.",
                userId: users[0]._id
            }
        );

        // Posts for user 2 (sam)
        posts.push(
            {
                title: "Tokyo Street Food Adventure",
                content: "From ramen to takoyaki, every bite was incredible. The energy in Shibuya at night is unmatched!",
                userId: users[1]._id
            },
            {
                title: "Northern Lights in Iceland",
                content: "Dancing green lights across the sky. Worth every freezing minute! Hot chocolate by the fire after was perfect.",
                userId: users[1]._id
            }
        );

        // Posts for user 3 (jordan)
        posts.push(
            {
                title: "Safari in Tanzania",
                content: "Witnessed the great migration and saw lions, elephants, and giraffes in their natural habitat. Life-changing experience!",
                userId: users[2]._id
            },
            {
                title: "Beach Paradise in Maldives",
                content: "Crystal clear waters, overwater bungalows, and the most stunning coral reefs. Pure relaxation and beauty.",
                userId: users[2]._id
            },
            {
                title: "Amsterdam Canal Tour",
                content: "Cycling through the city, exploring museums, and cruising the canals. Such a charming and artistic city!",
                userId: users[2]._id
            }
        );

        const postsWithVectors = await Promise.all(
            posts.map(async (post) => ({
                ...post,
                vector: await generateEmbeddings(post.content)
            }))
        );

        await PostModel.create(postsWithVectors);
        console.log(`Created ${posts.length} posts`);

        console.log("\n✅ Seed data created successfully!");
        console.log("\nSample credentials:");
        console.log("Email: alex@example.com");
        console.log("Email: sam@example.com");
        console.log("Email: jordan@example.com");
        console.log("Password: password123");

        process.exit(0);
    } catch (error) {
        console.error("Error seeding data:", error);
        process.exit(1);
    }
};

seedData();
