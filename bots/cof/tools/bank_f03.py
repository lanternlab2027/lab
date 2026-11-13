# F-03 Indoor Place of Assembly Safety Personnel (consolidated F-03/F-04 booklet).
# Optional 6th element "theater": True marks section 2 (theaters), which the F-04 test excludes.
Q = [
("The FDNY may require at least one place of assembly safety personnel where the Certificate of Occupancy indicates how many people will gather INDOORS?",
 ["75 or more", "25 or more", "300 or more", "1,000 or more"],
 "Safety personnel may be required where 75 or more people gather indoors (200 or more outdoors).",
 10, "the Certificate of Occupancy indicates that 75 or more people will gather indoors or 200 or more outdoors."),

("The FDNY may require at least one place of assembly safety personnel where the Certificate of Occupancy indicates how many people will gather OUTDOORS?",
 ["200 or more", "50 or more", "75 or more", "5,000 or more"],
 "The outdoor threshold is 200 or more people (indoor is 75 or more).",
 10, "the Certificate of Occupancy indicates that 75 or more people will gather indoors or 200 or more outdoors."),

("For a temporary place of assembly (TPA) event, when must safety personnel arrive and how long must they stay?",
 ["At least 1 hour before the event, and until all audience members leave", "15 minutes before the event, until the event ends", "When the doors open, until the headliner finishes", "At least 4 hours before, until midnight"],
 "TPA safety personnel arrive at least 1 hour prior and remain until all audience members leave.",
 10, "the safety personnel are required to arrive at the premises at least 1 hour prior to the events and remain until all audience members leave."),

("For a temporary place of assembly event, where is the minimum number of safety personnel indicated?",
 ["On the TPA permit", "On the event ticket", "In the venue's liquor license", "On the Certificate of Fitness card"],
 "For TPA situations, the minimum number of safety personnel will be indicated on the TPA permit.",
 10, "For the temporary place of assembly situations, the minimum number of safety personnel will be indicated on the TPA permit."),

("According to the study material, how are most occupants of places of assembly likely to exit?",
 ["The same way they entered, even if it is not the nearest or safest exit", "Through the nearest emergency exit", "Through the exit closest to the stage", "Through the windows"],
 "Most occupants exit the way they came in; safety personnel help direct them to the nearest and safest exit.",
 9, "likely to exit the same way they entered the building, whether or not it is the nearest or safest exit."),

("What is the main duty of place of assembly safety personnel in a fire or other emergency?",
 ["To assist the occupants", "To fight the fire with hose lines", "To sell tickets", "To reset the fire alarm panel"],
 "Their main duties are to assist the occupants in the event of a fire or other emergency.",
 9, "Their main duties are to “assist the occupants” in the event of a fire or other emergency."),

("Which assembly occupancy group includes restaurants, bars and nightclubs?",
 ["A-2", "A-1", "A-4", "A-5"],
 "Group A-2 covers assembly uses intended for food and/or drink consumption, such as restaurants, taverns, bars and nightclubs.",
 14, "Assembly Group A-2 includes assembly uses intended for food and/or drink consumption."),

("Which assembly occupancy group includes motion picture theaters and concert halls, usually with fixed seating?",
 ["A-1", "A-2", "A-3", "A-5"],
 "Group A-1 is for the production and viewing of performing arts or motion pictures, usually with fixed seating.",
 14, "Assembly Group A-1 occupancy includes assembly uses usually with fixed seating, intended for the production and viewing of performing arts or motion pictures."),

("Which assembly occupancy group includes amusement parks, bleachers, grandstands and stadiums?",
 ["A-5", "A-1", "A-2", "A-3"],
 "Group A-5 covers participation in or viewing of outdoor activities.",
 14, "Assembly Group A-5 includes assembly uses intended for participation in or viewing outdoor activities."),

("What is an \"assembly area\" as defined in the study material?",
 ["A designated area outside a building to which occupants report during an evacuation", "The main seating area of a theater", "The lobby where tickets are sold", "A storage room for folding chairs"],
 "An assembly area is a designated area outside of a building where occupants report upon evacuation.",
 12, "A designated area outside of a building to which building occupants are directed to report upon implementation of a partial or full evacuation"),

("What is a \"partial evacuation\"?",
 ["The emptying of a building of some but not all occupants", "Evacuating only employees", "Evacuating everyone except the safety personnel", "Moving occupants to the roof"],
 "Partial evacuation is the emptying of some but not all building occupants in response to a fire or emergency.",
 13, "Partial Evacuation - The emptying of a building of some but not all building occupants in response to a fire or an emergency."),

("Which are the two duties of place of assembly safety personnel named in the study material?",
 ["Maintaining occupant safety during a gathering, and assisting in implementing the evacuation plan", "Selling tickets and checking IDs", "Repairing sprinklers and testing alarms", "Cooking and serving food safely"],
 "The two duties are maintaining the safety of occupants and assisting in implementing the evacuation plan.",
 23, "Two duties of the place of assembly safety personnel are: (1) maintaining the safety of the occupants during a gathering; and (2) assisting"),

("If defects are found during the pre-event visual check, when should arrangements be made to correct them?",
 ["Immediately", "After the event ends", "Within 30 days", "At the next annual inspection"],
 "The owner or designated responsible person should arrange to have defects corrected IMMEDIATELY.",
 24, "should make arrangements to have the defects corrected IMMEDIATELY."),

("If a required fire protection system is out of service at a place of assembly, what is required?",
 ["Additional F-01 fire guard(s)", "Nothing, if the event is short", "An extra ticket taker", "Only a sign on the door"],
 "If any required fire protection system is out of service, additional F-01 fire guard(s) are required.",
 24, "If any required fire protection system is out of service, additional F-01 fire guard(s) is/are required."),

("In the ESCAPE pre-event inspection acronym, what does \"C\" stand for?",
 ["Capacity", "Cleaning", "Cameras", "Curtains"],
 "C is Capacity: the number of people does not exceed the posted capacity and capacity certificates are posted.",
 25, "C - Capacity – The number of persons occupying the building or space does not exceed the posted capacity."),

("In the ESCAPE pre-event inspection acronym, what does \"P\" stand for?",
 ["Protection (smoke, fire alarm, sprinkler systems and extinguishers in working order)", "Parking", "Permits", "Pyrotechnics"],
 "P is Protection: smoke, fire alarm and sprinkler systems and fire extinguishers are in proper working order.",
 25, "P - Protection – Smoke, fire alarm, sprinkler systems, and fire extinguishers are in proper working order."),

("What does the first \"E\" in the ESCAPE acronym check?",
 ["Exits are unblocked, unlocked, and properly marked", "Elevators are running", "Electrical panels are labeled", "Entertainment schedule is posted"],
 "E is Exits: all exits are unblocked, unlocked, and properly marked.",
 25, "E - Exits – All exits are unblocked, unlocked, and properly marked"),

("During an event you notice your area is excessively crowded. What should you do?",
 ["Inform your supervisor immediately and follow their instructions", "Ignore it until the event ends", "Lock the exit doors to stop more people entering", "Pull the fire alarm"],
 "If your responsible area is excessively crowded, inform your supervisor immediately and follow his/her instruction.",
 27, "If you notice that your responsible area is excessively crowded, you should inform your supervisor immediately and follow his/her instruction."),

("Are people allowed to stand in a required aisle during an event?",
 ["No", "Yes, if seats are full", "Yes, during intermission only", "Yes, if they are staff"],
 "Required aisles must be unobstructed; people are NOT allowed to stand in an aisle.",
 27, "Required aisles must be unobstructed. People are NOT allowed to stand, in an aisle."),

("In a performing arts or motion picture theater, when must the Certificate of Fitness holder conduct daily visual checks?",
 ["On any day the premises is to be used and occupied for a performance", "Once a week", "Only on opening night", "Only when the FDNY is present"],
 "Daily visual checks are required on any day the theater is used and occupied for a performance.",
 29, "must conduct the daily visual checks in a performing arts or motion picture theater on any day in which the premises is to be used", True),

("In a theater, how should standpipe and sprinkler system monthly inspection records be kept?",
 ["Up to date, in a bound logbook, readily available to the FDNY", "On loose sheets in the manager's car", "Only on a personal phone", "They do not need to be kept"],
 "Monthly inspection records should be up to date, in a bound logbook and readily available for FDNY inspection.",
 29, "Standpipe and sprinkler systems monthly inspection records should be up to date and in a bound logbook", True),

("How long must theater logbooks and records be kept on the premises?",
 ["A minimum of three years", "A minimum of 30 days", "A minimum of one year", "Until the end of the current show's run"],
 "All logbooks and records must be kept on the premises for a minimum of three years.",
 30, "All logbooks and records must be kept on the premises for a minimum of three (3) years", True),

("How soon before the start of each performance should the exit location announcement be made?",
 ["Not more than 10 minutes prior", "At least 1 hour prior", "Exactly 30 minutes prior", "Only after the performance ends"],
 "The audio announcement about exits should be made not more than 10 minutes before the start of each performance.",
 30, "The event coordinator should make an audio announcement not more than 10 minutes prior to the start of each performance or program.", True),

("How high must the rope, tape or barrier separating a standing area in a theater be?",
 ["Not less than 3 feet and not more than 4 feet above the floor", "Not less than 1 foot and not more than 2 feet", "Exactly 6 feet", "At least 8 feet"],
 "Standing areas are separated by barriers not less than 3 feet and not more than 4 feet above the floor.",
 30, "A height of not less than 3 feet and not more than 4 feet above the floor", True),

("How many rows of persons are allowed to stand in theater balconies?",
 ["Only one row", "Two rows", "Three rows", "As many as fit"],
 "For balconies, only one row of persons is allowed to stand.",
 30, "For balconies, only one row of persons is allowed to stand in balconies.", True),

("You hold both an F-03 and an F-01 Certificate of Fitness. A sprinkler system is out of service during a performance. Can you perform both duties at the same time?",
 ["No", "Yes, if the theater is small", "Yes, with supervisor approval", "Yes, F-03 duties include F-01 duties"],
 "The F-03 does not cover F-01 duties, and an F-01 holder cannot do both duties at the same time.",
 31, "If you hold an F-01 Certificate of Fitness, you CANNOT do both duties at the same time.", True),

("Before a temporary place of assembly event, what must the sponsor and any promoter provide?",
 ["A site plan approved by the NYC Department of Buildings", "A list of performers", "A catering menu", "A parking plan approved by the police"],
 "The sponsor and promoter must provide a site plan approved by the NYC Department of Buildings.",
 32, "the sponsor and any promoter of the event must provide a site plan approved by the NYC Department of Buildings."),

("At a TPA event, what must every safety personnel posted at an exit normally be equipped with?",
 ["A two-way radio (walkie-talkie)", "A ticket scanner", "A bullhorn only", "A fire hose"],
 "Personnel at an exit must have two-way radio communication to reach persons manning a telephone to the Fire Department.",
 32, "every safety personnel posted at an exit must be equipped with a two-way radio communication (walkie-talkie)"),

("At a TPA event, what must safety personnel posted at an event entrance normally be equipped with?",
 ["A device to verify the occupancy count, such as a scanner or hand-held counter", "A fire extinguisher only", "A first aid kit only", "A flare gun"],
 "Personnel at an entrance need a device (scanner, hand-held counter, ticket) to verify the occupancy count.",
 32, "every safety personnel posted at an event entrance must be equipped with a device (e.g., scanner, hand-held counter, ticket) to verify the occupancy count."),

("At an outdoor public gathering, what is prohibited regarding portable CNG cylinders?",
 ["Their storage, handling and use", "Only their sale", "Nothing; they are allowed anywhere", "Only using them after dark"],
 "The storage, handling and use of portable CNG cylinders are prohibited at outdoor public gatherings.",
 34, "The storage, handling and use of portable CNG cylinders are prohibited at outdoor public gatherings."),

("At an outdoor public gathering, when must fueling of generators be done?",
 ["Before the event is open to the public", "During intermission", "Whenever the fuel runs low", "After the first hour of the event"],
 "All fueling of generators and other approved devices must be done before the event opens to the public.",
 34, "all fueling of generators and other approved devices, equipment and systems must be conducted before the event is open to the public."),

("May guests charge or store lithium-ion batteries (e-bikes, scooters) at TPA events?",
 ["No", "Yes, in any corridor", "Yes, if supervised by a guest", "Yes, if the battery is under 50% charge"],
 "Guests are NOT permitted to charge or store lithium-ion batteries at events.",
 34, "Guests are NOT permitted to charge or store lithium-ion batteries at events."),

("What is required to use pyrotechnics at an event?",
 ["A permit from the FDNY", "Nothing, if the event is outdoors", "Permission from the headliner", "A sign saying \"fireworks in use\""],
 "Pyrotechnic use is strictly prohibited without a permit from the FDNY.",
 34, "Pyrotechnic use is strictly prohibited without a permit from the FDNY."),

("Why should electric wires at an event be secured by cord covers?",
 ["To minimize tripping hazards", "To make them waterproof", "To hide them from inspectors", "To increase the power supply"],
 "Wires should be secured by cord covers to minimize tripping hazards.",
 33, "The electric wires should be secured by cord covers in order to minimize the tripping hazards."),

("What hazard do temporary, unsecured or un-ganged chairs pose?",
 ["A great hazard in an emergency", "No hazard if they are new", "Only a hazard indoors", "Only a hazard for staff"],
 "Chairs should be ganged; unsecured or un-ganged chairs may pose a great hazard in an emergency.",
 34, "Temporary, unsecured or un-ganged chairs may pose a great hazard in event of emergency."),

("What is the most effective way to notify the building occupants in case of a fire emergency?",
 ["Activating the fire alarm pull station", "Shouting from the stage", "Sending a text message", "Turning off the lights"],
 "Activating the pull station is the most effective way to notify the building occupants of a fire.",
 37, "Activating the pull station is the most effective way to notify the building occupants in case of a fire emergency."),

("After a pull station has been activated, when can the fire alarm control panel be reset?",
 ["Only when directed by a Fire Department representative, by an S-95 holder", "Immediately by the safety personnel", "By any staff member once the alarm stops", "Only at the pull station itself"],
 "The alarm must be reset at the main FACP after the pull station is reset, and only when directed by a Fire Department representative, by an S-95 holder.",
 38, "Only when directed by a Fire Department representative, an S-95 holder, the alarm control panel can then be re-set."),

("What equipment does the FDNY highly recommend place of assembly safety personnel carry?",
 ["A flashlight, a two-way radio and a cell phone", "A fire axe and a hose", "A ladder and a hard hat", "A megaphone and a whistle only"],
 "The FDNY highly recommends a flashlight, a two-way radio communication device and a cell phone.",
 42, "the FDNY highly recommends that you should be equipped with a flashlight, two-way radio communication device (e.g., walkie talkie), and a cell phone."),

("You reach your post and have no cellular service. What should you do?",
 ["Immediately notify your supervisor and plan another form of communication", "Leave your post to find a signal", "Do nothing until an emergency happens", "Go home"],
 "If you have no cellular service, immediately notify your supervisor and plan another form of communication.",
 42, "If you reach your post and have no cellular service, you should immediately notify your supervisor."),

("In a fire emergency with no fire safety director or FEP staff in charge, where should you evacuate occupants to?",
 ["Along evacuation routes to the assembly areas designated by the evacuation plan", "To the nearest elevator lobby", "To the roof", "Into the basement"],
 "Without an FSD or FEP staff, evacuate along evacuation routes to assembly areas designated by the plan.",
 43, "evacuate the area (in-building relocation, partial evacuation, or evacuation of building occupants) along evacuation routes to assembly areas designated by the evacuation plan."),

("For place of assembly events with attendance over what number may an on-site emergency health care facility be provided?",
 ["5,000 people", "75 people", "500 people", "100,000 people"],
 "For events with attendance over 5,000, an on-site emergency health care facility may be provided.",
 43, "For the place of assembly events with an attendance of over 5,000 people, an on-site emergency health care facility may be provided."),

("During a medical emergency, when should the victim be moved?",
 ["Only if the victim's location is unsafe", "Always, to the lobby", "Always, to the nearest exit", "As soon as the victim can stand"],
 "Do not move the victim unless the victim's location is unsafe.",
 44, "Do not move the victim unless the victim’s location is unsafe."),

("You find a suspicious package and cannot verify its contents. What should you do with it?",
 ["Do not touch, move or open it", "Open it carefully to check", "Carry it outside", "Throw it in the trash"],
 "For a suspicious package, do not touch, move or open the article and follow emergency reporting protocols.",
 44, "Do not touch/move/open the article."),

("Should the manual fire alarm be activated during an active shooter emergency?",
 ["No; pull stations should only be activated during fire or smoke conditions", "Yes, always", "Yes, to evacuate everyone immediately", "Yes, but only on the ground floor"],
 "The manual fire alarm should NOT be activated for an active shooter emergency.",
 48, "Manual Fire Alarm System should NOT be activated for an active shooter emergency."),

("If an active shooter incident is occurring OUTSIDE the building, what should safety personnel do with building occupants?",
 ["Prevent them from evacuating, to avoid the outside threat", "Evacuate everyone out the front door", "Send them to the parking lot", "Tell them to go look"],
 "Secure entrances, relocate occupants to safe areas, and prevent occupants from evacuating into the outside threat.",
 45, "prevent building occupants from evacuating to avoid encountering the outside threat."),

("What are the three survival tactics suggested by the NYPD for an active shooter incident inside a building?",
 ["Avoid, Barricade, Confront", "Run, Call, Wait", "Stop, Drop, Roll", "Pull, Aim, Squeeze"],
 "The three tactics are Avoid (run/evacuate), Barricade (hide), Confront (fight/take action).",
 45, "following one of the three tactics: Avoid, Barricade, Confront."),

("Class K fires involve which materials?",
 ["Vegetable oils, animal oils or fats in cooking appliances", "Ordinary combustibles like wood and paper", "Energized electrical equipment", "Combustible metals"],
 "Class K fires involve vegetable oils, animal oils, or fats in cooking appliances, as in commercial kitchens.",
 52, "Class K fires are fires that involve vegetable oils, animal oils, or fats in cooking appliances."),

("How can you identify an FDNY outdoor portable fire extinguisher tag?",
 ["The series number on the back contains a \"D\" letter", "It is printed on paper", "It has no hologram", "It is always blue"],
 "Outdoor tags are durable and tear resistant; the series number on the back contains a \"D\" and/or an \"O\" is printed on the front.",
 56, "On the back of the tag, the series number will contain a “D” letter;"),

("What lesson does the study material draw from the Station Nightclub fire (West Warwick, RI, 2003)?",
 ["The club did not have an automatic fire sprinkler system", "The club had too many exits", "The band had a valid pyrotechnics permit", "The fire was caused by a kitchen grease fire"],
 "Lessons learned include that the club did not have an automatic fire sprinkler system to extinguish the fire.",
 19, "The club did not have an automatic fire sprinkler system to extinguish the fire."),
]
