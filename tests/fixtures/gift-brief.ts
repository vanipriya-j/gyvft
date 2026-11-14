import type { GiftBrief } from "@/lib/validation/gift-brief";
export const gift: GiftBrief = {
  recipient_type: "person",
  recipients: [
    {
      name: "Sam",
      description: "A lifelong friend who enjoys quiet weekends",
      likes: "Books and gardening",
      dislikes: "Plastic packaging",
    },
  ],
  group_size: 1,
  occasion_description: "Celebrating a milestone birthday",
  gift_message: "Thank you for always being there",
  budget_basis: "per_recipient",
  budget_amount: 2500.5,
  currency: "INR",
  delivery_date: "2099-12-01",
};
