# F-01 Fire Guard for Impairment. Each tuple: (question, [correct, d1, d2, d3], explanation, pdf_page, quote)
# Correct answer is always listed first here; build.py shuffles deterministically.
Q = [
("What is the maximum building floor area that one F-01 fire guard may patrol?",
 ["50,000 square feet", "10,000 square feet", "25,000 square feet", "100,000 square feet"],
 "One fire guard may not patrol more than 50,000 sq ft; larger areas need more than one fire guard.",
 9, "No individual fire guard must patrol more than 50,000 square feet of building floor area."),

("How often must a fire guard patrol all areas where the fire protection system is out of service?",
 ["At least once every hour", "At least once every 15 minutes", "At least once every 4 hours", "Once per shift"],
 "Patrols of the affected areas are required at least once every hour.",
 9, "A fire guard must be available to patrol all areas in which the fire protection system is out of service at least once every hour."),

("For an area of 50,000 sq ft or less, after how many hours of an out-of-service condition must patrols be done only by F-01 fire guards?",
 ["4 hours", "1 hour", "8 hours", "24 hours"],
 "For the first 4 hours the impairment coordinator or a trained, designated person may do the fire watch; after that only F-01 holders may.",
 9, "After 4 hours of an out of service condition, such patrols can only be conducted by fire guards holding the F-01 certificate of fitness."),

("When are impairment fire guards required while a system remains out of service?",
 ["24 hours a day, until the systems are restored to good working order", "Only during business hours", "Only overnight when the building is empty", "Only for the first 8 hours"],
 "Impairment fire guards are required around the clock until the systems are restored.",
 9, "The impairment fire guard(s) are required on a 24 hours a day basis. Impairment duties must continue until the systems are restored"),

("How long must the records relating to maintenance of fire protection systems be kept at the location?",
 ["Three years", "Six months", "One year", "Ten years"],
 "The owner must keep these records at the location for three years, available to any member of the FDNY.",
 9, "Such records must be kept at the location for a period of three years and made available for inspection by any member of the FDNY."),

("If no impairment coordinator has been designated, who must act as the impairment coordinator?",
 ["The building owner", "The F-01 fire guard", "The nearest fire company", "The central station company"],
 "In the absence of an impairment coordinator, the building owner acts as the impairment coordinator.",
 9, "In absence of an impairment coordinator the building owner must act as the impairment coordinator."),

("At a construction site, who must be designated as impairment coordinator when an installed and approved fire protection system is out of service?",
 ["The Construction Site Fire Safety Manager (S-56)", "The F-01 fire guard on duty", "The tower crane operator", "The FDNY inspector"],
 "The S-56 Construction Site Fire Safety Manager must be designated as the impairment coordinator.",
 10, "The Construction Site Fire Safety Manager (S-56) must be designated to be the impairment coordinator"),

("At a construction site, when is no impairment coordinator or fire watch required for a fire protection system?",
 ["Before the system is installed and approved", "Only on weekends", "Whenever fewer than 10 workers are on site", "Whenever the standpipe is out of service"],
 "No impairment coordinator or fire watch is required before the system is installed and approved (all required approvals and sign-offs obtained).",
 10, "No impairment coordinator or fire watch is required before the system is installed and approved"),

("Which best describes a \"central station\"?",
 ["A facility that receives alarm signals from a protected premises and reports them to the Fire Department", "The main fire alarm control panel in the lobby", "The FDNY headquarters testing center", "A room where portable fire extinguishers are stored"],
 "A central station receives alarm signals from a protected premises and retransmits or reports them to the department.",
 11, "A facility that receives alarm signals from a protected premises and retransmits or otherwise reports such alarm signals to the department."),

("Which best describes a \"fire watch\"?",
 ["A temporary measure ensuring continuous and systematic surveillance of a building to identify fire hazards and detect fire", "A permanent sprinkler system installed in a building", "A monthly inspection of fire extinguishers", "An electronic smoke detection system"],
 "A fire watch is a temporary measure of continuous, systematic surveillance by qualified individuals.",
 12, "A temporary measure intended to ensure continuous and systematic surveillance of a building or portion thereof by one or more qualified individuals"),

("What is an \"impairment\"?",
 ["Any condition in which a fire protection system cannot perform its designed fire safety function", "A fire that has been extinguished", "A building with more than one exit", "A scheduled fire drill"],
 "An impairment is any condition that stops a fire protection system from performing its designed fire safety function.",
 13, "IMPAIRMENT: Any condition in which a fire protection system cannot perform its designed fire safety function."),

("Who designates the impairment coordinator?",
 ["The owner", "The F-01 fire guard", "The central station company", "The Department of Buildings"],
 "The impairment coordinator is the person designated by the owner.",
 13, "IMPAIRMENT COORDINATOR: The person designated by the owner and responsible for ensuring that proper notification and safety precautions are taken"),

("Which of the following is listed as \"hot work\"?",
 ["Brazing", "Painting", "Mopping floors", "Sweeping"],
 "Hot work includes cutting, welding, brazing, soldering, grinding, thawing pipe and similar operations.",
 13, "HOT WORK. Cutting, welding, thermit welding, brazing, soldering, grinding, thermal spraying, thawing pipe, cadwelding"),

("A means of egress consists of which three parts?",
 ["Exit access, exit, and exit discharge", "Stairs, elevators, and lobby", "Doors, windows, and roof", "Corridor, sprinkler, and standpipe"],
 "The three parts of a means of egress are the exit access, the exit and the exit discharge.",
 13, "A means of egress consists of three separate and distinct parts: the exit access, the exit and the exit discharge."),

("Which of the following is an example of an UNPLANNED out-of-service condition?",
 ["A major leak in the system water piping", "Taking a system out of service for scheduled testing", "Taking a system out of service for a planned alteration", "Routine scheduled servicing of a component"],
 "Unplanned conditions are serious defects such as empty tanks, breaks or major leaks in piping; testing, servicing and alterations are planned removals.",
 14, "Unplanned out of service conditions are serious defects such as empty tanks, breaks or major leaks in the system water piping"),

("Before starting to patrol, the fire guard should have enough knowledge to identify which of the following?",
 ["The entry routes to the affected area", "The building's assessed property value", "Every tenant's lease expiration date", "The elevator manufacturer's name"],
 "Before patrolling, the fire guard should know entry routes, level of out-of-service condition, hazardous materials, extinguisher locations and means of notification.",
 15, "the fire guard should have enough knowledge to identify: (1) the entry routes to the affected area;"),

("In an office building (Group B) with a Fire and Life Safety Director, who must the fire guard work closely with?",
 ["The Fire and Life Safety Director (FLSD)", "The building's elevator mechanic", "The nearest police precinct", "The tenants' association"],
 "There is normally at least one FLSD in Group B and R-1 buildings, and the fire guard must work closely with the FLSD.",
 15, "The fire guard must work closely with the FLSD (Fire and Life Safety Director)."),

("According to the study material, which statement about hazardous materials risk is correct?",
 ["Flammable liquids are more dangerous than combustible liquids", "Combustible liquids are more dangerous than flammable liquids", "Non-flammable compressed gas is more dangerous than propane", "Quantity of hazardous material does not affect risk"],
 "Flammable liquids are more dangerous than combustible liquids, and flammable compressed gas is more dangerous than non-flammable gas.",
 16, "Flammable liquids are more dangerous than combustible liquids."),

("A building has both its sprinkler system and its fire alarm system out of service. Compared with only one system impaired, the risk to occupants is:",
 ["Greater", "The same", "Lower", "Not affected, as long as exits are clear"],
 "When both systems are out of service, the risk to building occupants is greater than when only one is impaired.",
 16, "If a building has both an out of service sprinkler system and fire alarm system, the risk to building occupants is greater"),

("Per the orientation checklist, what must the fire guard do if no fire extinguishers are provided in the area of responsibility?",
 ["Carry one fire extinguisher with them", "Skip the fire watch for that area", "Wait for the FDNY to deliver one", "Use a garden hose instead"],
 "If extinguishers are not provided, the fire guard must carry one.",
 17, "If no, I must carry one fire extinguisher with me."),

("Can a fire guard on impairment duty be assigned other responsibilities during the fire watch?",
 ["No, they cannot be given any other responsibilities", "Yes, light maintenance work is allowed", "Yes, they may also work as the building doorman", "Yes, if the area is under 10,000 square feet"],
 "Fire guards must make regular inspections of their area and cannot be given other responsibilities.",
 18, "The fire guards need to make regular inspections of the assigned area. They cannot be given any other responsibilities."),

("How wide is the exit aisle generally required to be?",
 ["At least 3 feet", "At least 1 foot", "At least 18 inches", "At least 10 feet"],
 "The exit aisle is generally required to be at least 3 feet wide.",
 18, "The exit aisle is generally required to be at least 3 feet wide."),

("What should happen if the fire guard finds a lock or chain on an exit door while the building is in use?",
 ["It must be removed immediately and reported to the building owner", "It may stay if the door is rarely used", "The fire guard should note it at the end of the month", "It may stay until the next FDNY inspection"],
 "Locks, bolts and chains cannot be on exit doors while the building is in use; they must be removed immediately and reported to the owner.",
 18, "chains cannot be installed on the exit doors while the building is in use. If locks are seen, they must be removed immediately."),

("How should self-closing doors be kept when not in use?",
 ["Closed at all times", "Propped open for ventilation", "Open during business hours", "Locked from both sides"],
 "Self-closing doors slow the spread of fire and must not be left open for any reason.",
 18, "The fire guard must ensure that all self-closing doors are not left open for any reason."),

("Is hot work allowed in areas of a building where the sprinkler system is impaired?",
 ["No", "Yes, with a fire extinguisher nearby", "Yes, during daylight hours only", "Yes, if the fire alarm is working"],
 "The fire guard must know that hot work is not allowed where the sprinkler system is impaired.",
 19, "The fire guard must know that hot work is not allowed in areas of a building where the sprinkler system is impaired."),

("At a construction site, impairment of which system(s) means hot work operations are not allowed?",
 ["The sprinkler system or the standpipe system", "Only the elevator system", "Only the lighting system", "Only the HVAC system"],
 "At a construction site, hot work is not allowed if either the sprinkler or the standpipe system is impaired.",
 19, "At a construction site, hot work operations are not allowed if the sprinkler system or the standpipe system is impaired."),

("If there is an accumulation of trash in the building, who must be promptly notified?",
 ["The building owner", "The Department of Sanitation", "The central station", "The tenants on that floor only"],
 "Trash is a fire hazard; if it accumulates, the building owner must be promptly notified.",
 19, "If there is an accumulation of trash, building owner must be promptly notified."),

("For how long must the fire watch inspection record be kept on the premises?",
 ["At least 3 years", "At least 30 days", "At least 6 months", "At least 1 year"],
 "The record must be kept on the premises for at least 3 years and be available to the Fire Department.",
 19, "A record must be kept on the premises for at least 3 years and maintained by the assigned person."),

("Which item must be logged in the fire guard's daily written record?",
 ["The fire guard's name, Certificate of Fitness number and signature", "The weather forecast", "The number of building tenants", "The building's insurance policy number"],
 "The record must include inspections completed, defects, violations, and the date, name, C of F number and signature of the fire guard.",
 19, "(d) the date, name, Certificate of Fitness number and signature of the fire guard who conducted the inspections."),

("On the hourly fire watch log, how should an unsatisfactory item be marked?",
 ["X", "OK", "N/A", "Leave it blank"],
 "Mark \"OK\" for satisfactory, \"X\" for unsatisfactory and \"N/A\" for not applicable items.",
 20, "Mark “OK” for items that are satisfactory, “X” for items that are unsatisfactory"),

("When must the Fire Department be notified that a standpipe system is out of service?",
 ["Whenever it is or will be out of service for any period of time", "Only if it is out for more than 8 hours", "Only if it is out on more than one floor", "Only if a fire occurs"],
 "Standpipe outages must be reported for any period of time.",
 21, "Notification must be made to the department whenever a standpipe system is or will be out of service for any period of time."),

("A sprinkler system must be reported to the Fire Department if it cannot be restored to service within how many hours?",
 ["8 hours", "1 hour", "24 hours", "72 hours"],
 "Notify the Department if sprinkler work or repairs cannot be completed and the system restored within 8 hours.",
 21, "the work or repairs cannot be completed, and the system restored to service, within 8 hours"),

("Which situation requires the Fire Department to be notified that a sprinkler or fire alarm system is out of service?",
 ["The system is or will be out of service on more than one floor", "The system is out of service for 10 minutes on one floor for a test", "A single smoke detector is being dusted", "The building manager changes"],
 "Out of service on more than one floor is one of the listed notification triggers.",
 21, "The sprinkler system or fire alarm system is or will be out of service on more than one floor of a building"),

("According to the study material, what is the most direct and effective way to notify the Fire Department?",
 ["By phone", "By email", "By sending a letter", "By waiting for the central station"],
 "Notifying by phone is the most direct and effective way to notify the Fire Department.",
 21, "Notifying by phone is the most direct and effective way to notify the Fire Department."),

("A fire guard discovers a fire. When should they notify the impairment coordinator or FLSD?",
 ["Immediately, but only after calling 911", "Before calling 911", "At the end of the shift", "Only if the fire spreads"],
 "Call 911 first, then immediately notify the impairment coordinator, FLSD, CSFSM or other on-site responsible personnel.",
 22, "The fire guard must also immediately notify the impairment coordinator, FLSD, CSFSM or other on-site responsible personnel, but only after calling 911."),

("During a fire, which occupants are in the greatest danger and must be evacuated first?",
 ["Occupants on the fire floor and the floor above", "Occupants on the ground floor", "Occupants in the basement only", "Occupants on the top floor only"],
 "Occupants on the fire floor and the floor above are in the greatest danger.",
 22, "Occupants on the fire floor and the floor above are in the greatest danger and must be evacuated first."),

("When calling 911, when should you hang up?",
 ["When the operator instructs you to", "As soon as you give the address", "After 30 seconds", "As soon as you hear sirens"],
 "Do not hang up the phone until the operator instructs you to.",
 22, "Finally, do not hang up the phone until the operator instructs you to."),

("You hear a fire alarm sounding after someone used a manual pull station. What should you assume about the FDNY?",
 ["Do not assume the FDNY was notified; a call to 911 must always be made", "The FDNY has automatically been notified", "The FDNY only needs to be called if smoke is visible", "The central station will always send the FDNY"],
 "Manual pull stations may not directly transmit a signal to the FDNY, so a phone call must always be made.",
 23, "The manual pull stations may not directly transmit a signal to the FDNY. A phone call must always be made to 911"),

("How many steps does a double action manual pull station require to activate the alarm?",
 ["Two", "One", "Three", "Four"],
 "Double action stations require two steps: break a glass/open a door/lift a cover, then operate the switch or lever.",
 23, "Double action stations: Double action stations require 2 steps in order to activate the alarm."),

("After a pull station is activated, who may reset the alarm at the main Fire Alarm Control Panel?",
 ["An S-95 Certificate of Fitness holder, after being advised by a Fire Department representative", "The F-01 fire guard, at any time", "Any building occupant", "The person who pulled the station"],
 "The alarm must be reset at the main FACP and only by an S-95 holder after being advised by a Fire Department representative.",
 24, "The alarm may be reset only by an S-95 Certificate of Fitness holder after being advised by a Fire Department representative."),

("How far from the exit doorway opening must pull stations be located?",
 ["Within 5 feet", "Within 25 feet", "Within 50 feet", "Within 100 feet"],
 "Pull stations must be within 5 feet of the exit doorway opening and never blocked.",
 24, "Pull stations must be located within 5 feet from the exit doorway opening and never be blocked."),

("How high may the top of a mounted portable fire extinguisher be above the floor?",
 ["Not more than 5 feet", "Not more than 3 feet", "Not more than 7 feet", "Not more than 10 feet"],
 "The top of the extinguisher must not be more than 5 feet above the floor.",
 27, "All fire extinguishers must be mounted so that the top of the extinguisher is not more than 5 feet above the floor."),

("What is the minimum clearance between the bottom of a fire extinguisher and the floor?",
 ["At least 4 inches", "At least 1 inch", "At least 12 inches", "No clearance; it may sit on the floor"],
 "The bottom should be at least 4 inches from the floor; extinguishers are not allowed on the floor.",
 27, "The bottom of the fire extinguisher should be at least 4 inches from the floor. Fire extinguishers are NOT allowed to be on the floor."),

("What does P.A.S.S. stand for when using a fire extinguisher?",
 ["Pull, Aim, Squeeze, Sweep", "Push, Alert, Spray, Stop", "Point, Activate, Shake, Spray", "Pull, Alarm, Signal, Shout"],
 "P.A.S.S. stands for Pull, Aim, Squeeze, and Sweep.",
 29, "P.A.S.S. stands for Pull, Aim, Squeeze, and Sweep."),

("Which type of extinguisher must NOT be used on a Class C (electrical) fire?",
 ["Water or foam", "CO2", "Dry chemical rated B:C", "Multi-purpose A:B:C dry chemical"],
 "Class C fires need extinguishers that do not conduct electricity; foam and water types must not be used.",
 29, "Foam and water type extinguishers must not be used to extinguish electrical fires."),

("Class D fires involve which materials?",
 ["Ignitable metals such as magnesium and titanium", "Wood, paper and cloth", "Gasoline and oil", "Energized electrical equipment"],
 "Class D fires are caused by ignitable metals; water should not be used on them.",
 29, "Class D fires are caused by ignitable metals, such as magnesium, titanium, and metallic sodium"),

("Who is responsible for selecting the person who does the monthly \"quick check\" of portable fire extinguishers?",
 ["The owner of the business", "The FDNY", "The W-96 company", "The extinguisher manufacturer"],
 "The business owner selects the person to do the monthly quick check.",
 31, "The owner of the business is responsible for selecting a person to do a monthly inspection."),

("At least how often must portable fire extinguishers be checked by a W-96 Certificate of Fitness holder from an FDNY-approved company?",
 ["Annually", "Weekly", "Monthly", "Every five years"],
 "At least annually a W-96 holder from an FDNY-approved company must check all portable fire extinguishers and replace the tag.",
 31, "At least annually all Portable Fire Extinguishers must be checked by a W-96 Certificate of Fitness holder from FDNY approved company."),

("How large is the genuine hologram strip on an FDNY portable fire extinguisher tag?",
 ["3 inches long by ¼ inch wide", "1 inch long by 1 inch wide", "6 inches long by ½ inch wide", "There is no hologram on genuine tags"],
 "A real hologram strip is 3 inches long by 1/4 inch wide and changes color as it is moved.",
 30, "A real hologram strip shown on the tag is 3 inches long by ¼ inch wide."),

("According to FDNY lithium-ion battery guidance, how should batteries be charged?",
 ["Plugged directly into a wall electrical outlet", "Plugged into a power strip", "Overnight while unattended", "Under a pillow to keep them warm"],
 "Always plug directly into a wall outlet; never use a power strip or charge overnight.",
 32, "plug directly into a wall electrical outlet for charging."),

("When charging more than five personal mobility devices (or their removable batteries), where must the charging take place?",
 ["In a dedicated room with ventilation and a self-closing door", "In the main exit corridor", "In any stairwell", "Outdoors only, under a tarp"],
 "Charging more than five devices must be in a dedicated room with ventilation and a self-closing door.",
 33, "more than five (5) personal mobility devices or their removable batteries, it must be in a dedicated room with ventilation and a self-closing door."),

("After all visible fire on a lithium-ion battery has been put out, what does the study material warn?",
 ["The battery may re-ignite minutes, hours or even days later", "The battery is permanently safe", "The battery can be immediately recharged", "Re-ignition only happens if water was used"],
 "Reignition is common; lithium-ion batteries can unexpectedly re-ignite minutes, hours and even days later.",
 34, "Lithium-Ion Batteries are known to unexpectedly re-ignite (without warning) minutes, hours and even days after all visible fire has been put out."),

("A sprinkler head is described as \"fused.\" What does that mean?",
 ["The sprinkler head has opened", "The sprinkler head is painted over", "The sprinkler head is missing", "The sprinkler head was recently inspected"],
 "The term \"fused\" means that sprinkler heads opened.",
 26, "The term “fused” means that sprinkler heads opened."),

("What is a \"wet\" standpipe system?",
 ["A system that is always filled with water (\"charged\")", "A system whose pipes are dry and empty when not in use", "A system that only uses foam", "A system that is out of service"],
 "Wet systems are charged, meaning they are always filled with water; dry systems are empty when not in use.",
 27, "Wet systems are “charged,” meaning that they are always filled with water."),
]
