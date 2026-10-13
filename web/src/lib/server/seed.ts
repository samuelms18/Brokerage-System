// Demo data for the prototype. All names, phone numbers and addresses are
// fictional. Owner records and exact addresses are included ON PURPOSE so
// the privacy tests can prove they never reach a student response.

import type { Amenity, Area, Bed, BedStatus, Broker, BrokeragePolicy, College, Owner, Property, Room, User } from "./model";

export const areas: Area[] = [
  { id: "area-north", name: "North Campus", city: "Pune" },
  { id: "area-riverside", name: "Riverside", city: "Pune" },
  { id: "area-hill", name: "Hill Road", city: "Pune" },
];

export const colleges: College[] = [
  { id: "col-wit", name: "Westbridge Institute of Technology", shortName: "WIT", areaId: "area-north" },
  { id: "col-cac", name: "City Arts & Commerce College", shortName: "CAC", areaId: "area-riverside" },
  { id: "col-lmc", name: "Lakeside Medical College", shortName: "LMC", areaId: "area-hill" },
];

export const amenities: Amenity[] = [
  { id: "am-wifi", name: "Wi-Fi", category: "building" },
  { id: "am-meals", name: "Meals", category: "food" },
  { id: "am-laundry", name: "Laundry", category: "building" },
  { id: "am-ac", name: "AC", category: "room" },
  { id: "am-power", name: "Power backup", category: "building" },
  { id: "am-cctv", name: "CCTV", category: "safety" },
  { id: "am-warden", name: "Warden", category: "safety" },
  { id: "am-study", name: "Study room", category: "building" },
  { id: "am-gym", name: "Gym", category: "building" },
  { id: "am-parking", name: "Two-wheeler parking", category: "building" },
  { id: "am-water", name: "RO water", category: "food" },
  { id: "am-housekeeping", name: "Housekeeping", category: "building" },
];

export const staffUsers: User[] = [
  { id: "u-admin", role: "super_admin", name: "Platform Admin", phone: "+910000000001", status: "active" },
  // Asha holds the brokerage-override permission in the demo only (who should have it is open question BR-1).
  { id: "u-broker-asha", role: "broker", name: "Asha Kulkarni", phone: "+919800000011", status: "active", canOverrideBrokerage: true },
  { id: "u-broker-ravi", role: "broker", name: "Ravi Menon", phone: "+919800000012", status: "active" },
  { id: "u-broker-neha", role: "broker", name: "Neha Joshi", phone: "+919800000013", status: "active" },
];

export const brokers: Broker[] = [
  { userId: "u-broker-asha", displayName: "Asha K.", businessPhone: "+912040000011", acceptingLeads: true, maxActiveLeads: 40, lastAssignedAt: null, areaIds: ["area-north"], propertyIds: [], unavailable: [] },
  { userId: "u-broker-ravi", displayName: "Ravi M.", businessPhone: "+912040000012", acceptingLeads: true, maxActiveLeads: 40, lastAssignedAt: null, areaIds: ["area-riverside", "area-north"], propertyIds: [], unavailable: [] },
  { userId: "u-broker-neha", displayName: "Neha J.", businessPhone: "+912040000013", acceptingLeads: true, maxActiveLeads: 40, lastAssignedAt: null, areaIds: ["area-hill"], propertyIds: [], unavailable: [] },
];

/** PRIVATE */
export const owners: Owner[] = [
  { id: "own-1", name: "Prakash Deshmukh", phone: "+919822000101", email: "prakash.owner@example.com", address: "Flat 4, Shanti Niwas, North Campus" },
  { id: "own-2", name: "Meera Patil", phone: "+919822000102", email: "meera.owner@example.com", address: "22 Riverside Lane" },
  { id: "own-3", name: "Sanjay Rao", phone: "+919822000103", email: "sanjay.owner@example.com", address: "9 Hill Road Society" },
];

let bedSeq = 0;
function room(id: string, label: string, sharing: number, rent: number, deposit: number,
              opts: { ac?: boolean; bath?: boolean; taken?: number; reserved?: number; freeFrom?: string } = {}): Room {
  const beds: Bed[] = [];
  for (let i = 0; i < sharing; i++) {
    let status: BedStatus = "available";
    if (i < (opts.taken ?? 0)) status = "occupied";
    else if (i < (opts.taken ?? 0) + (opts.reserved ?? 0)) status = "reserved";
    beds.push({
      id: `bed-${++bedSeq}`,
      label: String.fromCharCode(65 + i),
      status,
      availableFrom: status === "occupied" && opts.freeFrom ? opts.freeFrom : null,
    });
  }
  return {
    id, label, sharing, roomType: opts.ac ? "ac" : "non_ac", attachedBathroom: !!opts.bath,
    rentPerBed: rent, depositPerBed: deposit, maintenancePerBed: 0, status: "active", beds,
  };
}

const rules = "No smoking or alcohol on premises. Visitors allowed in the common area until 8 pm. Gate closes at 10:30 pm.";

export const properties: Property[] = [
  {
    id: "prop-1001", code: "PR-1001", brokerId: "u-broker-asha",
    title: "Sunrise Residency for Students",
    description: "Bright, well-ventilated rooms a short walk from the main campus gate. Daily housekeeping, home-style meals and a quiet study room on the top floor.",
    propertyType: "pg", genderPolicy: "male", areaId: "area-north", localityLabel: "Near North Campus bus stop",
    approxLatitude: 18.5310, approxLongitude: 73.8470, maintenanceFee: null, foodIncluded: true, houseRules: rules,
    availableFrom: "2026-11-01", status: "partially_occupied", publishedAt: "2026-09-02",
    amenityIds: ["am-wifi", "am-meals", "am-laundry", "am-power", "am-study", "am-housekeeping", "am-water"],
    collegeDistances: [{ collegeId: "col-wit", km: 0.6 }, { collegeId: "col-cac", km: 3.4 }],
    photos: [
      { hue: 32, scene: "room", caption: "Two-sharing room", isPublic: true },
      { hue: 200, scene: "common", caption: "Study room", isPublic: true },
      { hue: 140, scene: "kitchen", caption: "Dining area", isPublic: true },
      { hue: 0, scene: "building", caption: "Front gate with house number", isPublic: false },
    ],
    rooms: [
      room("r-1001-1", "Room 1", 2, 8500, 17000, { taken: 1, freeFrom: "2027-01-01" }),
      room("r-1001-2", "Room 2", 3, 7000, 14000, { taken: 1, reserved: 1 }),
      room("r-1001-3", "Room 3", 1, 12000, 24000, { ac: true, bath: true }),
    ],
    private: { ownerId: "own-1", addressLine1: "Plot 14, Shanti Niwas, Lane 3", landmark: "Opposite Gupta Medicals", pincode: "411007", latitude: 18.53247, longitude: 73.84822 },
  },
  {
    id: "prop-1002", code: "PR-1002", brokerId: "u-broker-asha",
    title: "Greenleaf Girls Hostel",
    description: "Secure hostel with a resident warden, CCTV and biometric entry. Meals included, with a separate study hall.",
    propertyType: "hostel", genderPolicy: "female", areaId: "area-north", localityLabel: "Behind the North Campus library",
    approxLatitude: 18.5290, approxLongitude: 73.8440, maintenanceFee: 500, foodIncluded: true, houseRules: rules,
    availableFrom: null, status: "published", publishedAt: "2026-09-12",
    amenityIds: ["am-wifi", "am-meals", "am-cctv", "am-warden", "am-study", "am-water", "am-laundry"],
    collegeDistances: [{ collegeId: "col-wit", km: 0.9 }, { collegeId: "col-cac", km: 3.0 }],
    photos: [
      { hue: 320, scene: "room", caption: "Three-sharing room", isPublic: true },
      { hue: 260, scene: "common", caption: "Study hall", isPublic: true },
    ],
    rooms: [
      room("r-1002-1", "Room A1", 3, 6500, 13000, {}),
      room("r-1002-2", "Room A2", 2, 7800, 15600, { taken: 1 }),
    ],
    private: { ownerId: "own-1", addressLine1: "Plot 31, Library Road", landmark: "Next to Sai Temple", pincode: "411007", latitude: 18.52811, longitude: 73.84590 },
  },
  {
    id: "prop-1003", code: "PR-1003", brokerId: "u-broker-ravi",
    title: "Riverside 2BHK Shared Flat",
    description: "Furnished 2BHK shared by four students. Fully equipped kitchen, washing machine and a balcony facing the river walk.",
    propertyType: "flat", genderPolicy: "any", areaId: "area-riverside", localityLabel: "Riverside walk, near the food court",
    approxLatitude: 18.5150, approxLongitude: 73.8600, maintenanceFee: 800, foodIncluded: false, houseRules: "Shared cleaning schedule. Quiet hours after 11 pm.",
    availableFrom: "2026-11-15", status: "published", publishedAt: "2026-08-20",
    amenityIds: ["am-wifi", "am-laundry", "am-power", "am-parking", "am-water"],
    collegeDistances: [{ collegeId: "col-cac", km: 1.2 }, { collegeId: "col-wit", km: 2.8 }],
    photos: [
      { hue: 190, scene: "common", caption: "Living room", isPublic: true },
      { hue: 45, scene: "kitchen", caption: "Kitchen", isPublic: true },
      { hue: 210, scene: "room", caption: "Bedroom", isPublic: true },
    ],
    rooms: [
      room("r-1003-1", "Bedroom 1", 2, 9500, 28500, { ac: true, bath: true }),
      room("r-1003-2", "Bedroom 2", 2, 8800, 26400, { taken: 1, freeFrom: "2026-12-01" }),
    ],
    private: { ownerId: "own-2", addressLine1: "B-602, Riverview Apartments", landmark: "Above HDFC ATM", pincode: "411001", latitude: 18.51622, longitude: 73.86119 },
  },
  {
    id: "prop-1004", code: "PR-1004", brokerId: "u-broker-ravi",
    title: "Commerce Lane Budget PG",
    description: "Simple, clean rooms at a budget price, five minutes from City Arts & Commerce College.",
    propertyType: "pg", genderPolicy: "male", areaId: "area-riverside", localityLabel: "Commerce Lane",
    approxLatitude: 18.5180, approxLongitude: 73.8560, maintenanceFee: null, foodIncluded: false, houseRules: rules,
    availableFrom: null, status: "published", publishedAt: "2026-09-25",
    amenityIds: ["am-wifi", "am-water", "am-parking"],
    collegeDistances: [{ collegeId: "col-cac", km: 0.5 }, { collegeId: "col-wit", km: 3.1 }],
    photos: [{ hue: 100, scene: "room", caption: "Four-sharing room", isPublic: true }],
    rooms: [
      room("r-1004-1", "Room 1", 4, 4800, 9600, { taken: 2 }),
      room("r-1004-2", "Room 2", 4, 4800, 9600, {}),
    ],
    private: { ownerId: "own-2", addressLine1: "House 7, Commerce Lane", landmark: "Behind Ganesh Dairy", pincode: "411001", latitude: 18.51877, longitude: 73.85533 },
  },
  {
    id: "prop-1005", code: "PR-1005", brokerId: "u-broker-neha",
    title: "Hillview Medico Residency",
    description: "Single and twin rooms for medical students, with 24-hour power backup, a gym and a library corner. Ten minutes from Lakeside Medical College.",
    propertyType: "hostel", genderPolicy: "any", areaId: "area-hill", localityLabel: "Hill Road, near the hospital shuttle stop",
    approxLatitude: 18.5040, approxLongitude: 73.8320, maintenanceFee: 1000, foodIncluded: true, houseRules: rules,
    availableFrom: null, status: "published", publishedAt: "2026-07-30",
    amenityIds: ["am-wifi", "am-meals", "am-ac", "am-power", "am-gym", "am-cctv", "am-study", "am-housekeeping"],
    collegeDistances: [{ collegeId: "col-lmc", km: 0.8 }],
    photos: [
      { hue: 170, scene: "room", caption: "Single AC room", isPublic: true },
      { hue: 15, scene: "common", caption: "Gym", isPublic: true },
    ],
    rooms: [
      room("r-1005-1", "Single 101", 1, 14500, 29000, { ac: true, bath: true }),
      room("r-1005-2", "Twin 102", 2, 10500, 21000, { ac: true, bath: true, taken: 1 }),
      room("r-1005-3", "Twin 103", 2, 10500, 21000, { ac: true, bath: true, taken: 2, freeFrom: "2027-06-01" }),
    ],
    private: { ownerId: "own-3", addressLine1: "Hillcrest Bungalow 3", landmark: "Next to petrol pump", pincode: "411004", latitude: 18.50513, longitude: 73.83144 },
  },
  {
    id: "prop-1006", code: "PR-1006", brokerId: "u-broker-neha",
    title: "Lakeside Independent Room",
    description: "Independent room with a private entrance and attached bathroom, ideal for a postgraduate student.",
    propertyType: "independent_room", genderPolicy: "any", areaId: "area-hill", localityLabel: "Lake side of Hill Road",
    approxLatitude: 18.5010, approxLongitude: 73.8350, maintenanceFee: null, foodIncluded: false, houseRules: "No pets.",
    availableFrom: "2026-12-01", status: "published", publishedAt: "2026-10-01",
    amenityIds: ["am-wifi", "am-power", "am-parking"],
    collegeDistances: [{ collegeId: "col-lmc", km: 1.5 }],
    photos: [{ hue: 230, scene: "room", caption: "Room with private entrance", isPublic: true }],
    rooms: [room("r-1006-1", "Independent room", 1, 11000, 33000, { bath: true })],
    private: { ownerId: "own-3", addressLine1: "Plot 11, Lake View Society", landmark: "Gate 2", pincode: "411004", latitude: 18.50162, longitude: 73.83611 },
  },
  {
    id: "prop-1007", code: "PR-1007", brokerId: "u-broker-asha",
    title: "Campus Edge Shared House",
    description: "A friendly shared house with a large garden, a common kitchen and weekly housekeeping.",
    propertyType: "shared_house", genderPolicy: "any", areaId: "area-north", localityLabel: "Campus Edge colony",
    approxLatitude: 18.5340, approxLongitude: 73.8500, maintenanceFee: 600, foodIncluded: false, houseRules: rules,
    availableFrom: null, status: "fully_occupied", publishedAt: "2026-06-10",
    amenityIds: ["am-wifi", "am-laundry"],
    collegeDistances: [{ collegeId: "col-wit", km: 1.1 }],
    photos: [{ hue: 90, scene: "building", caption: "Garden", isPublic: true }],
    rooms: [room("r-1007-1", "Room 1", 2, 7500, 15000, { taken: 2 })],
    private: { ownerId: "own-1", addressLine1: "12 Campus Edge", landmark: "Corner house", pincode: "411007", latitude: 18.53491, longitude: 73.85012 },
  },
  {
    id: "prop-1008", code: "PR-1008", brokerId: "u-broker-ravi",
    title: "Draft: New Riverside PG",
    description: "Not yet verified, so it must not appear in the marketplace.",
    propertyType: "pg", genderPolicy: "any", areaId: "area-riverside", localityLabel: "Riverside",
    approxLatitude: 18.5160, approxLongitude: 73.8590, maintenanceFee: null, foodIncluded: false, houseRules: rules,
    availableFrom: null, status: "verification", publishedAt: "2026-10-10",
    amenityIds: ["am-wifi"],
    collegeDistances: [{ collegeId: "col-cac", km: 1.0 }],
    photos: [{ hue: 60, scene: "room", caption: "Room", isPublic: true }],
    rooms: [room("r-1008-1", "Room 1", 2, 6000, 12000, {})],
    private: { ownerId: "own-2", addressLine1: "5 River Lane", landmark: "", pincode: "411001", latitude: 18.51601, longitude: 73.85902 },
  },
];

/**
 * EXAMPLE policy so the brokerage flow can be demonstrated. The real values
 * are configured by Super Admin (decision D-04); nothing here is a business
 * decision.
 */
export const brokeragePolicies: BrokeragePolicy[] = [
  {
    id: "pol-example", name: "Example policy (replace with real values)", areaId: null, propertyType: null, priority: 0,
    payerMode: "both",
    student: { calcType: "percent_of_monthly_rent", value: 50 },
    owner: { calcType: "flat", value: 2000 },
    isActive: true, createdAt: 0,
  },
];
