"""Short "Did you know?" lines for Chicago Then, keyed by a substring of the
photo's place label (see make_picks.py). First match wins, so specific keys
come before general ones.

Written for the game, not taken from LOC. Each line was checked on 2026-11-15
against the source noted beside it, and kept conservative (no superlatives
that the source does not make). The LOC caption and any LOC summary are shown
separately and verbatim.
"""

FSA = ("This photo was taken for the federal government's Farm Security Administration and Office of War "
       "Information, whose photographers recorded American life from 1935 to 1944.")  # loc.gov FSA/OWI collection page
RAIL = ("By the 1880s Chicago was already being called the \"railroad mecca of America,\" "
        "and it remained the nation's premier railroad hub.")  # Encyclopedia of Chicago, Railroads
L_TRAIN = ("Chicago's first elevated line opened in 1892. It was nicknamed the \"Alley L\" "
           "because it ran above alleys behind the buildings.")  # chicago-l.org, South Side Elevated
LINCOLN = ("Lincoln Park was renamed in 1865 to honor the recently assassinated Abraham Lincoln. "
           "Its oldest section began as the City Cemetery.")  # Wikipedia, Lincoln Park
JACKSON = ("Jackson Park was the site of the 1893 World's Columbian Exposition. The fair's Palace of Fine Arts "
           "is now the Museum of Science and Industry.")  # Wikipedia, Museum of Science and Industry
FIELD = ("The Field Museum began in the 1893 fair's Palace of Fine Arts in Jackson Park and moved north to "
         "its present building in the early 1920s.")  # Wikipedia, MSI (moved 1920; opened 1921)
STATE = ("Potter Palmer helped turn State Street into Chicago's main shopping street in the late 1860s. "
         "After the Great Fire burned his buildings, he borrowed $1.7 million to rebuild.")  # Wikipedia, Potter Palmer
UNION_STA = "Chicago's current Union Station opened in 1925 after ten years of construction."  # chicagounionstation.com
ZEPHYR = ("The Burlington's stainless-steel Pioneer Zephyr, which entered service in 1934, was the first "
          "diesel-powered streamliner in the United States.")  # Wikipedia, Pioneer Zephyr
STOCK = "The Union Stock Yards opened on Christmas Day 1865 and closed in 1971."  # Wikipedia, Union Stock Yards
SOUTH = ("Between 1940 and 1960, Chicago's Black population grew from 278,000 to 813,000. Most "
         "newcomers from the South settled on the city's South Side.")  # Encyclopedia of Chicago, African Americans
RIVER = ("In 1900 engineers reversed the Chicago River so it no longer carried the city's waste into "
         "Lake Michigan, its source of drinking water.")  # MWRD
BRIDGES = "The Chicago River has 38 movable bridges today, down from a peak of 52."  # Wikipedia, Chicago River
GRANT = ("Lake Park was renamed Grant Park in 1901, after Ulysses S. Grant. Merchant Aaron Montgomery Ward "
         "went to court four times to keep buildings out of it.")  # Wikipedia, Grant Park
LAKEFRONT = ("After the Great Fire of 1871, debris from the burned city was dumped into the lagoon along "
             "the lakefront, adding to the land that became Grant Park.")  # Wikipedia, Grant Park
GROWTH = ("Chicago grew from about 30,000 people in 1850 to more than a million in 1890, when it became "
          "the second-largest city in the United States.")  # census.gov, History and the Census: Chicago Fire
MICHIGAN = ("The Michigan Avenue Bridge opened in 1920, carrying the avenue across the river. "
            "It was first proposed in Daniel Burnham's Plan of Chicago.")  # Chicago History Museum
SOUTH_WATER = ("The Illinois Central Railroad was allowed into the city in 1852 on a trestle built offshore "
               "in Lake Michigan, and its tracks have hugged the lakefront ever since.")  # Encyclopedia of Chicago
STREETCAR = ("Chicago once claimed the largest streetcar system in the world. Its last streetcar ran "
             "on June 21, 1958.")  # WTTW, Ask Geoffrey

FACTS = [
    ("Chicago Beach Hotel", "The Chicago Beach Hotel was built in 1892 for visitors to the 1893 World's Columbian Exposition. It was torn down in 1970."),  # Wikipedia
    ("Masonic Temple", "Finished in 1892, the 21-story Masonic Temple was for years the tallest building in Chicago. It was torn down in 1939."),  # Wikipedia
    ("Art Institute", "The Art Institute's Michigan Avenue building was built with the city for the 1893 World's Columbian Exposition. The museum opened there in December 1893."),  # artic.edu
    ("Lake Shore Drive, Jackson Park", JACKSON),
    ("Lake Shore Drive", "Potter and Bertha Palmer's castle-like mansion on Lake Shore Drive, finished in 1885, established the wealthy Gold Coast neighborhood. It was torn down in 1950."),  # Wikipedia, Palmer Mansion
    ("Gold Coast", "Potter and Bertha Palmer's castle-like mansion on Lake Shore Drive, finished in 1885, established the wealthy Gold Coast neighborhood. It was torn down in 1950."),
    ("Drexel Boulevard", "Drexel Boulevard is part of Chicago's park and boulevard system, about 26 miles of wide, planted boulevards linking a ring of big parks."),  # Wikipedia
    ("Grand Boulevard", "Grand Boulevard was later renamed South Park Way. In 1968 it became Martin Luther King Jr. Drive, which made Chicago the first city to name a street for Dr. King."),  # Wikipedia
    ("Michigan Avenue from the lake", LAKEFRONT),
    ("Theater on Michigan", MICHIGAN),
    ("Michigan Avenue", MICHIGAN),
    ("Stoplight on Michigan", MICHIGAN),
    ("Madison", "Since a 1908 city council decision, Madison Street has divided Chicago's addresses into north and south. State and Madison is the zero point."),  # Wikipedia, Madison Street
    ("State Street", STATE),
    ("Dearborn Street", "Dearborn Street shares its name with Fort Dearborn, the U.S. Army post built beside the Chicago River in 1803."),  # Wikipedia, Fort Dearborn
    ("Jackknife", BRIDGES),
    ("Drawbridge", BRIDGES),
    ("Coal barge", RIVER),
    ("Grain elevators", RIVER),
    ("Public Library", "This building opened in 1897 as Chicago's main public library and is now the Chicago Cultural Center. The city says its Tiffany dome is the largest in the world."),  # Wikipedia, Chicago Cultural Center
    ("North Western passenger terminal", "The Chicago & North Western Terminal was built in 1911. Its head house was torn down in 1984 to make way for a glass skyscraper."),  # Wikipedia, Ogilvie
    ("North Western station", "Until 1911, Chicago & North Western trains used the Wells Street Station. A big new terminal west of the river replaced it that year."),  # Wikipedia, Ogilvie
    ("Lincoln Park Zoo", "Lincoln Park Zoo was founded in 1868 with a gift of swans from New York's Central Park. It is one of the few zoos with free admission."),  # Wikipedia, Lincoln Park Zoo
    ("Conservatory", "The Lincoln Park Conservatory was built in stages from 1890 to 1895."),  # Wikipedia, Lincoln Park
    ("Lincoln Park", LINCOLN),
    ("Field Columbian Museum", FIELD),
    ("Jackson Park", JACKSON),
    ("Auditorium", "The Auditorium Building, by Adler & Sullivan, was dedicated in 1889. Roosevelt University bought it in 1946 and still uses it."),  # Wikipedia
    ("Congress Plaza", "The two bronze horsemen at Congress Plaza, The Bowman and The Spearman, are by Croatian sculptor Ivan Meštrović and were installed in 1928."),  # Wikipedia
    ("Buckingham Fountain", "Buckingham Fountain was dedicated in 1927. Its design was inspired by the Latona Fountain at Versailles."),  # Wikipedia
    ("Grant Park", GRANT),
    ("Army tournament", GRANT),
    ("Skyline from the lake", LAKEFRONT),
    ("lake front", LAKEFRONT),
    ("waterfront", LAKEFRONT),
    ("Columbia Yacht Club", "The Columbia Yacht Club was founded in 1892. Today its clubhouse is a former ferry, the Abegweit, moored in Monroe Harbor."),  # hmdb marker; Wikipedia MV Abegweit
    ("Wabash Avenue", "The elevated Union Loop around downtown, which runs above Wabash Avenue, opened for service in the fall of 1897."),  # chicago-l.org
    ("The Loop from", "The elevated Union Loop around downtown opened for service in the fall of 1897."),
    ("Marshall Field", "Marshall Field, the University of Chicago's football field, was renamed Stagg Field in 1913. In 1942 the first nuclear chain reaction took place under its stands."),  # Wikipedia, Stagg Field
    ("University of Chicago", "The University of Chicago was founded in 1890 with a gift from John D. Rockefeller. Classes began on October 1, 1892."),  # Wikipedia
    ("Randolph", "Several large theaters stand on or near Randolph Street in the Loop, including the Cadillac Palace and the Nederlander."),  # Wikipedia, Randolph Street
    ("LaSalle", "LaSalle Street in the Loop is Chicago's financial district. The street ends at the Chicago Board of Trade Building."),  # Wikipedia, LaSalle Street
    ("Board of Trade", "The Chicago Board of Trade, organized in 1848, was the first grain futures exchange in the United States."),  # Britannica
    ("Garfield Park", "Garfield Park was first called Central Park. It was renamed in 1881 for the assassinated President James A. Garfield."),  # Wikipedia
    ("World's Columbian", "The 1893 World's Columbian Exposition celebrated the 400th anniversary of Columbus's voyage to America."),  # hydeparkhistory.org
    ("West Side Grounds", "The Cubs played at West Side Grounds from 1893 to 1915. They won the World Series in 1907 and 1908, the first team to win two in a row."),  # Illinois State Historical Society marker
    ("South Side Park", "The White Sox played at South Side Park until 1910. In 1906 they beat the Cubs there in baseball's first crosstown World Series."),  # Wikipedia, South Side Park
    ("Clark and Addison", "The ballpark at Clark and Addison opened in 1914 for the Federal League. The Cubs moved in in 1916, and it was named Wrigley Field in 1926."),  # MLB
    ("Stock Yard Gate", "The Union Stock Yard Gate on Exchange Avenue survives from the stockyards. It became a Chicago Landmark in 1972."),  # Wikipedia
    ("Stock Yards", STOCK),
    ("McCormick", "Cyrus McCormick and a partner built a reaper factory in Chicago in 1847. In 1902 his company merged into International Harvester."),  # Encyclopedia of Chicago
    ("Bird's-eye", GROWTH),
    ("harbor and skyline", GROWTH),
    ("47th Street", "The Regal Theater opened in 1928 near 47th Street and South Parkway. Duke Ellington, Ella Fitzgerald and Nat \"King\" Cole all played there."),  # Wikipedia, Regal Theater
    ("Regal Theater", "The Regal Theater opened in 1928 at 47th Street and South Parkway. Duke Ellington, Ella Fitzgerald and Nat \"King\" Cole all played there. It was torn down in 1973."),  # Wikipedia
    ("Black Belt", SOUTH),
    ("South Side", SOUTH),
    ("South Chicago", "South Chicago sits where the Calumet River meets Lake Michigan. Steel mills lined its shore from 1880 to 1992."),  # Wikipedia, South Chicago
    ("Ida B. Wells", "The Ida B. Wells Homes, built from 1939 to 1941, were named for the journalist and newspaper editor Ida B. Wells. The last buildings came down in 2011."),  # Wikipedia
    ("Zephyr", ZEPHYR),
    ("Burlington streamliner", ZEPHYR),
    ("Union Station", UNION_STA),
    ("Maxwell", "The Maxwell Street Market began in the late 1800s as a Sunday market. Its merchants encouraged blues players to set up outside their stores."),  # City of Chicago
    ("South Water Street", SOUTH_WATER),
    ("beach", RIVER),
    ("streetcar", STREETCAR),
    ("Clark Street", "Clark Street is named for George Rogers Clark, a soldier of the American Revolutionary War."),  # Wikipedia
    ("the L", L_TRAIN),
    ("elevated", L_TRAIN),
    ("Commuters", RAIL),
    ("Tracks leading", RAIL),
]

GENERIC = FSA


def fact_for(place):
    p = place.lower()
    for key, fact in FACTS:
        if key.lower() in p:
            return fact
    return None
