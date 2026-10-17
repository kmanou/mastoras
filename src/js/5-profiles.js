/* ================================================================== business profiles
   One app, five trades. A profile decides how equipment is called and described, the default
   maintenance checklist and exclusions, the measurements recorded on each visit and the
   register of periodic checks. Everything else (documents, payments, contracts) is shared. */

/* refrigerants: GWP over 100 years as in Annex I/II of Regulation (EU) 2024/573 (indicative; the
   nameplate and the manufacturer's data prevail and the value can be changed per unit).
   cls: hfc = Annex I (thresholds in t CO2e), hfo = Annex II section 1 (thresholds in kg), nat = not fluorinated */
const REFRIGERANTS = {
  R32: { gwp: 675, cls: 'hfc' }, R410A: { gwp: 2088, cls: 'hfc' }, R134a: { gwp: 1430, cls: 'hfc' }, R407C: { gwp: 1774, cls: 'hfc' },
  R404A: { gwp: 3922, cls: 'hfc' }, R507A: { gwp: 3985, cls: 'hfc' }, R452A: { gwp: 2140, cls: 'hfc' }, R448A: { gwp: 1387, cls: 'hfc' },
  R449A: { gwp: 1397, cls: 'hfc' }, R454B: { gwp: 466, cls: 'hfc' }, R513A: { gwp: 631, cls: 'hfc' }, R417A: { gwp: 2346, cls: 'hfc' },
  R422D: { gwp: 2729, cls: 'hfc' }, R1234yf: { gwp: 1, cls: 'hfo' }, R1234ze: { gwp: 1, cls: 'hfo' },
  R290: { gwp: 3, cls: 'nat' }, R600a: { gwp: 3, cls: 'nat' }, R744: { gwp: 1, cls: 'nat' }, R717: { gwp: 0, cls: 'nat' },
};
const mkChecklist = rows => rows.map(([g, t, ge, te], i) => ({ id: 'k' + (i + 1), g, t, ge: ge || '', te: te || '', on: true }));
const YESNO = [['', '—'], ['ok', ['Εντάξει', 'OK']], ['warn', ['Προσοχή', 'Attention']], ['bad', ['Πρόβλημα', 'Problem']]];

const PROFILES = {
  hvac: {
    label: ['Ψύξη & κλιματισμός', 'Refrigeration & A/C'], mark: 'snow',
    desc: ['Κλιματιστικά και ψυκτικά με BTU και ψυκτικό μέσο, μητρώο F-gas με υπενθύμιση ελέγχων διαρροής.', 'A/C and refrigeration units with BTU and refrigerant, F-gas register with leak-check reminders.'],
    eq: { one: ['Μηχάνημα', 'Unit'], many: ['Μηχανήματα', 'Units'], a: ['μηχάνημα', 'unit'], as: ['μηχανήματα', 'units'], abbr: ['μηχ.', 'units'], icon: '❄', none: ['Δεν υπάρχουν καταχωρημένα μηχανήματα.', 'No units registered.'] },
    kinds: [['Τοίχου', 'Wall-mounted'], ['Καναλάτο', 'Ducted'], ['Κασέτα', 'Cassette'], ['Δαπέδου / Οροφής', 'Floor / ceiling'], ['Ντουλάπα', 'Floor-standing'], ['Πολυδιαιρούμενο', 'Multi-split'], ['VRF / VRV', 'VRF / VRV'], ['Αντλία θερμότητας', 'Heat pump'], ['Ψυκτικός θάλαμος', 'Cold room'], ['Ψυγείο / βιτρίνα', 'Refrigerated cabinet'], ['Άλλο', 'Other']],
    brands: ['Inventor', 'Daikin', 'Mitsubishi Electric', 'Mitsubishi Heavy', 'LG', 'Samsung', 'Toshiba', 'Fujitsu', 'Gree', 'Midea', 'Panasonic', 'Hitachi', 'Carrier', 'Toyotomi', 'Sharp', 'Haier', 'Olimpia Splendid', 'Hisense', 'Kaisai', 'Bosch', 'Aux', 'TCL', 'Electrolux'],
    spec: 'btu',
    fields: [
      { k: 'btu', l: ['BTU', 'BTU'], type: 'int', ph: '12000', fmt: v => (+v).toLocaleString(DL === 'en' ? 'en-IE' : 'el-GR') + ' BTU' },
      { k: 'ref', l: ['Ψυκτικό μέσο', 'Refrigerant'], type: 'list', list: Object.keys(REFRIGERANTS), ph: 'R32' },
      { k: 'charge', l: ['Γόμωση (kg)', 'Charge (kg)'], type: 'dec', ph: '0,85' },
      { k: 'gwp', l: ['GWP', 'GWP'], type: 'int', ph: ['από το ψυκτικό', 'from refrigerant'] },
      { k: 'lds', l: ['Σύστημα ανίχνευσης διαρροών', 'Leak detection system'], type: 'bool' },
      { k: 'hermetic', l: ['Ερμητικά σφραγισμένο (με σήμανση)', 'Hermetically sealed (labelled)'], type: 'bool' },
    ],
    meas: [
      { k: 'leak', l: ['Έλεγχος διαρροής', 'Leak check'], short: ['Διαρροή', 'Leak'], type: 'sel', opts: [['', '—'], ['ok', ['Χωρίς διαρροή', 'No leak']], ['leak', ['Βρέθηκε διαρροή', 'Leak found']], ['fixed', ['Διαρροή · επισκευάστηκε', 'Leak repaired']]] },
      { k: 'add', l: ['Συμπλήρωση (kg)', 'Added (kg)'], short: ['+', '+'], type: 'dec', u: 'kg' },
      { k: 'rec', l: ['Ανάκτηση (kg)', 'Recovered (kg)'], short: ['Ανάκτ.', 'Rec.'], type: 'dec', u: 'kg' },
    ],
    measFor: m => true,
    register: 'fgas', regLabel: ['F-gas', 'F-gas'], regTitle: ['Μητρώο F-gas', 'F-gas register'],
    checklist: mkChecklist([
      ['Εσωτερική μονάδα', 'Καθαρισμός και απολύμανση φίλτρων αέρα', 'Indoor unit', 'Cleaning and disinfection of air filters'], ['Εσωτερική μονάδα', 'Καθαρισμός στοιχείου (εναλλάκτη) με ειδικό καθαριστικό', 'Indoor unit', 'Coil (heat exchanger) cleaning with a dedicated cleaner'], ['Εσωτερική μονάδα', 'Καθαρισμός λεκάνης και αποχέτευσης συμπυκνωμάτων', 'Indoor unit', 'Cleaning of the condensate tray and drain'], ['Εσωτερική μονάδα', 'Έλεγχος και καθαρισμός ανεμιστήρα (τουρμπίνας)', 'Indoor unit', 'Inspection and cleaning of the fan (blower)'],
      ['Καναλάτα / κασέτες', 'Καθαρισμός φίλτρων και στομίων', 'Ducted / cassette units', 'Cleaning of filters and grilles'], ['Καναλάτα / κασέτες', 'Οπτικός έλεγχος αεραγωγών και μονώσεών τους', 'Ducted / cassette units', 'Visual check of ducts and their insulation'],
      ['Εξωτερική μονάδα', 'Καθαρισμός στοιχείου συμπυκνωτή', 'Outdoor unit', 'Condenser coil cleaning'], ['Εξωτερική μονάδα', 'Έλεγχος ανεμιστήρα εξωτερικής μονάδας', 'Outdoor unit', 'Outdoor fan check'], ['Εξωτερική μονάδα', 'Έλεγχος βάσεων στήριξης και αντικραδασμικών', 'Outdoor unit', 'Check of mounting brackets and anti-vibration pads'],
      ['Ψυκτικό κύκλωμα', 'Μέτρηση πιέσεων λειτουργίας', 'Refrigerant circuit', 'Measurement of operating pressures'], ['Ψυκτικό κύκλωμα', 'Έλεγχος για διαρροές ψυκτικού υγρού', 'Refrigerant circuit', 'Refrigerant leak check'], ['Ψυκτικό κύκλωμα', 'Μέτρηση θερμοκρασιών προσαγωγής / επιστροφής', 'Refrigerant circuit', 'Supply / return air temperature measurement'],
      ['Ηλεκτρολογικός έλεγχος', 'Σύσφιξη ηλεκτρικών επαφών και κλεμμών', 'Electrical check', 'Tightening of electrical contacts and terminals'], ['Ηλεκτρολογικός έλεγχος', 'Μέτρηση κατανάλωσης ρεύματος συμπιεστή', 'Electrical check', 'Compressor current measurement'],
      ['Οπτικός έλεγχος', 'Μονώσεις σωληνώσεων', 'Visual check', 'Pipe insulation'], ['Οπτικός έλεγχος', 'Καλωδιώσεις και συνδέσεις', 'Visual check', 'Wiring and connections'], ['Οπτικός έλεγχος', 'Κελύφη μονάδων', 'Visual check', 'Unit casings'], ['Οπτικός έλεγχος', 'Λειτουργία τηλεχειριστηρίου / θερμοστάτη', 'Visual check', 'Remote control / thermostat operation']]),
    exclusions: [['Ανταλλακτικά και υλικά (π.χ. πλακέτες, κινητήρες, πυκνωτές).', 'Spare parts and materials (e.g. PCBs, motors, capacitors).'], ['Συμπλήρωση ή αναγόμωση ψυκτικού υγρού.', 'Refrigerant top-up or recharge.'], ['Αποκατάσταση βλαβών από κακή χρήση, διακυμάνσεις ρεύματος ή εξωτερικά αίτια.', 'Repair of damage caused by misuse, power fluctuations or external causes.'], ['Εργασίες που απαιτούν ανυψωτικό μηχάνημα ή ικρίωμα.', 'Work requiring a lifting platform or scaffolding.'], ['Επισκέψεις για βλάβη εκτός του προγράμματος, οι οποίες χρεώνονται χωριστά.', 'Call-outs for faults outside the schedule, which are charged separately.']],
    per: ['μηχάνημα', 'unit'],
  },
  plumb: {
    label: ['Υδραυλικός · θέρμανση', 'Plumbing & heating'], mark: 'initials',
    desc: ['Λέβητες, καυστήρες, θερμοσίφωνες, ηλιακοί, αντλίες. Μετρήσεις καυσαερίων στην επίσκεψη και υπενθύμιση ετήσιου ελέγχου.', 'Boilers, burners, water heaters, solar, pumps. Flue-gas measurements on each visit and annual check reminders.'],
    eq: { one: ['Συσκευή', 'Appliance'], many: ['Συσκευές', 'Appliances'], a: ['συσκευή', 'appliance'], as: ['συσκευές', 'appliances'], abbr: ['συσκ.', 'appl.'], icon: '♨', none: ['Δεν υπάρχουν καταχωρημένες συσκευές.', 'No appliances registered.'] },
    kinds: [['Λέβητας πετρελαίου', 'Oil boiler'], ['Λέβητας αερίου', 'Gas boiler'], ['Λέβητας συμπύκνωσης', 'Condensing boiler'], ['Λέβητας pellet / ξύλου', 'Pellet / wood boiler'], ['Καυστήρας', 'Burner'], ['Θερμοσίφωνας', 'Water heater'], ['Ηλιακός θερμοσίφωνας', 'Solar water heater'], ['Αντλία θερμότητας', 'Heat pump'], ['Boiler ΖΝΧ', 'Hot water cylinder'], ['Κυκλοφορητής', 'Circulation pump'], ['Πιεστικό συγκρότημα', 'Booster pump set'], ['Ενδοδαπέδια θέρμανση', 'Underfloor heating'], ['Άλλο', 'Other']],
    brands: ['Buderus', 'Viessmann', 'Vaillant', 'Bosch', 'Baxi', 'Ariston', 'Immergas', 'Riello', 'Ferroli', 'Wolf', 'Beretta', 'Junkers', 'De Dietrich', 'Hoval', 'Grundfos', 'Wilo', 'DAB', 'Lowara', 'Ebara', 'Sole', 'Calpak', 'Nobel', 'Malta', 'Thermostahl', 'Elco', 'Weishaupt', 'Ecoflam', 'Lamborghini'],
    spec: 'kw',
    fields: [
      { k: 'kw', l: ['Ισχύς (kW)', 'Output (kW)'], type: 'dec', ph: '24', fmt: v => dpct(v) + ' kW' },
      { k: 'fuel', l: ['Καύσιμο / ενέργεια', 'Fuel / energy'], type: 'sel', opts: [['', '—'], ['oil', ['Πετρέλαιο', 'Heating oil']], ['gas', ['Φυσικό αέριο', 'Natural gas']], ['lpg', ['Υγραέριο', 'LPG']], ['pellet', ['Pellet / ξύλο', 'Pellet / wood']], ['el', ['Ηλεκτρικό', 'Electric']], ['solar', ['Ηλιακό', 'Solar']]] },
    ],
    meas: [
      { k: 'co', l: ['CO (ppm)', 'CO (ppm)'], short: ['CO', 'CO'], type: 'dec', u: 'ppm' },
      { k: 'co2', l: ['CO₂ (%)', 'CO₂ (%)'], short: ['CO₂', 'CO₂'], type: 'dec', u: '%' },
      { k: 'o2', l: ['O₂ (%)', 'O₂ (%)'], short: ['O₂', 'O₂'], type: 'dec', u: '%' },
      { k: 'tf', l: ['Θερμ. καυσαερίων (°C)', 'Flue gas temp. (°C)'], short: ['Tκ', 'Tf'], type: 'dec', u: '°C' },
      { k: 'eff', l: ['Απόδοση (%)', 'Efficiency (%)'], short: ['Απόδ.', 'Eff.'], type: 'dec', u: '%' },
      { k: 'smoke', l: ['Αιθάλη (Bacharach)', 'Smoke no. (Bacharach)'], short: ['Αιθ.', 'Smoke'], type: 'dec', u: '' },
    ],
    measFor: m => ['oil', 'gas', 'lpg', 'pellet'].includes(m.fuel) || (!m.fuel && /λέβητ|καυστ/i.test(m.kind || '')),
    register: 'combustion', regLabel: ['Έλεγχοι καύσης', 'Combustion checks'], regTitle: ['Έλεγχοι καύσης', 'Combustion checks'],
    checklist: mkChecklist([
      ['Λέβητας / καυστήρας', 'Καθαρισμός λέβητα και θαλάμου καύσης', 'Boiler / burner', 'Cleaning of the boiler and combustion chamber'], ['Λέβητας / καυστήρας', 'Καθαρισμός καπναγωγού', 'Boiler / burner', 'Flue pipe cleaning'], ['Λέβητας / καυστήρας', 'Καθαρισμός και ρύθμιση καυστήρα, αλλαγή μπεκ και φίλτρου', 'Boiler / burner', 'Burner cleaning and adjustment, nozzle and filter replacement'], ['Λέβητας / καυστήρας', 'Μέτρηση καυσαερίων και ρύθμιση καύσης', 'Boiler / burner', 'Flue-gas analysis and combustion adjustment'], ['Λέβητας / καυστήρας', 'Έλεγχος ασφαλιστικών διατάξεων και θερμοστατών', 'Boiler / burner', 'Check of safety devices and thermostats'],
      ['Δίκτυο θέρμανσης', 'Έλεγχος πίεσης και εξαέρωση', 'Heating circuit', 'Pressure check and air bleeding'], ['Δίκτυο θέρμανσης', 'Έλεγχος κυκλοφορητή', 'Heating circuit', 'Circulation pump check'], ['Δίκτυο θέρμανσης', 'Έλεγχος δοχείου διαστολής', 'Heating circuit', 'Expansion vessel check'], ['Δίκτυο θέρμανσης', 'Έλεγχος για διαρροές σε σωληνώσεις και βάνες', 'Heating circuit', 'Leak check of pipes and valves'],
      ['Ζεστό νερό', 'Έλεγχος θερμοσίφωνα / boiler και ανοδίου', 'Hot water', 'Water heater / cylinder and anode check'], ['Ζεστό νερό', 'Έλεγχος βαλβίδας ασφαλείας', 'Hot water', 'Safety valve check'],
      ['Αναφορά', 'Συμπλήρωση φύλλου ελέγχου και ρύθμισης καύσης', 'Report', 'Completion of the combustion check and adjustment sheet']]),
    exclusions: [['Ανταλλακτικά και υλικά (π.χ. μπεκ, φίλτρα, ηλεκτρόδια, κυκλοφορητές).', 'Spare parts and materials (e.g. nozzles, filters, electrodes, pumps).'], ['Καθαρισμός καπνοδόχου που απαιτεί ειδικό εξοπλισμό ή πρόσβαση σε ύψος.', 'Chimney cleaning requiring special equipment or work at height.'], ['Αποκατάσταση βλαβών από κακή χρήση, παγετό ή την ποιότητα του νερού.', 'Repair of damage caused by misuse, frost or water quality.'], ['Επισκέψεις για βλάβη εκτός του προγράμματος, οι οποίες χρεώνονται χωριστά.', 'Call-outs for faults outside the schedule, which are charged separately.']],
    per: ['συσκευή', 'appliance'],
  },
  elec: {
    label: ['Ηλεκτρολόγος', 'Electrician'], mark: 'initials',
    desc: ['Πίνακες, γειώσεις, Η/Ζ, φωτοβολταϊκά, φορτιστές. Μετρήσεις γείωσης, ρελέ και μόνωσης, ημερομηνίες ΥΔΕ και επανελέγχων.', 'Panels, earthing, generators, PV, EV chargers. Earth, RCD and insulation measurements, certificate and re-inspection dates.'],
    eq: { one: ['Εγκατάσταση', 'Installation'], many: ['Εγκαταστάσεις', 'Installations'], a: ['εγκατάσταση', 'installation'], as: ['εγκαταστάσεις', 'installations'], abbr: ['εγκ.', 'inst.'], icon: 'ϟ', none: ['Δεν υπάρχουν καταχωρημένες εγκαταστάσεις.', 'No installations registered.'] },
    kinds: [['Ηλεκτρική εγκατάσταση κατοικίας', 'Residential installation'], ['Ηλεκτρική εγκατάσταση επαγγελματικού χώρου', 'Commercial installation'], ['Γενικός πίνακας', 'Main distribution board'], ['Υποπίνακας', 'Sub-distribution board'], ['Γείωση', 'Earthing system'], ['Ηλεκτροπαραγωγό ζεύγος', 'Generator set'], ['UPS', 'UPS'], ['Φωτοβολταϊκό σύστημα', 'PV system'], ['Φορτιστής ηλεκτρικού οχήματος', 'EV charger'], ['Φωτισμός ασφαλείας', 'Emergency lighting'], ['Αντικεραυνική προστασία', 'Lightning protection'], ['Άλλο', 'Other']],
    brands: ['Schneider Electric', 'Hager', 'ABB', 'Siemens', 'Legrand', 'Eaton', 'Gewiss', 'Finder', 'Doepke', 'General Electric', 'Chint', 'Fronius', 'SMA', 'Huawei', 'SolarEdge', 'Wallbox', 'Kostal', 'Pramac', 'Riello UPS'],
    spec: 'amps',
    fields: [
      { k: 'amps', l: ['Ονομαστικό ρεύμα / παροχή (A)', 'Rated current / supply (A)'], type: 'dec', ph: '40', fmt: v => dpct(v) + ' A' },
      { k: 'phase', l: ['Παροχή', 'Supply'], type: 'sel', opts: [['', '—'], ['1', ['Μονοφασική', 'Single-phase']], ['3', ['Τριφασική', 'Three-phase']]] },
      { k: 'ude', l: ['Ημ/νία ΥΔΕ', 'Installer certificate date'], type: 'date' },
      { k: 'nextInsp', l: ['Επόμενος επανέλεγχος', 'Next re-inspection'], type: 'date' },
    ],
    meas: [
      { k: 'earth', l: ['Αντίσταση γείωσης (Ω)', 'Earth resistance (Ω)'], short: ['Γείωση', 'Earth'], type: 'dec', u: 'Ω' },
      { k: 'rcdma', l: ['Ρελέ διαρροής (mA)', 'RCD trip current (mA)'], short: ['Ρελέ', 'RCD'], type: 'dec', u: 'mA' },
      { k: 'rcdms', l: ['Χρόνος ρελέ (ms)', 'RCD trip time (ms)'], short: ['t', 't'], type: 'dec', u: 'ms' },
      { k: 'ins', l: ['Αντίσταση μόνωσης (MΩ)', 'Insulation resistance (MΩ)'], short: ['Μόνωση', 'Insul.'], type: 'dec', u: 'MΩ' },
    ],
    measFor: m => true,
    register: 'inspection', regLabel: ['Μετρήσεις', 'Measurements'], regTitle: ['Μετρήσεις & επανέλεγχοι', 'Measurements & re-inspections'],
    checklist: mkChecklist([
      ['Πίνακες', 'Οπτικός έλεγχος πινάκων και καλωδιώσεων', 'Boards', 'Visual check of boards and wiring'], ['Πίνακες', 'Σύσφιξη κλεμμών και ακροδεκτών', 'Boards', 'Tightening of terminals'], ['Πίνακες', 'Έλεγχος για υπερθέρμανση (οπτικός / θερμογραφικός)', 'Boards', 'Check for overheating (visual / thermal camera)'], ['Πίνακες', 'Δοκιμή ρελέ διαρροής με το κουμπί και με όργανο', 'Boards', 'RCD test with the test button and with an instrument'],
      ['Μετρήσεις', 'Μέτρηση αντίστασης γείωσης', 'Measurements', 'Earth resistance measurement'], ['Μετρήσεις', 'Μέτρηση αντίστασης μόνωσης', 'Measurements', 'Insulation resistance measurement'], ['Μετρήσεις', 'Μέτρηση τάσεων και φορτίων ανά φάση', 'Measurements', 'Voltage and load measurement per phase'],
      ['Εξοπλισμός', 'Έλεγχος φωτισμού ασφαλείας', 'Equipment', 'Emergency lighting check'], ['Εξοπλισμός', 'Έλεγχος Η/Ζ και αυτόματου μεταγωγικού', 'Equipment', 'Generator and automatic transfer switch check'], ['Εξοπλισμός', 'Έλεγχος UPS και μπαταριών', 'Equipment', 'UPS and battery check'],
      ['Αναφορά', 'Καταγραφή μετρήσεων και ενημέρωση πελάτη', 'Report', 'Recording of measurements and briefing the client']]),
    exclusions: [['Υλικά και εξοπλισμός (π.χ. ασφαλειοδιακόπτες, ρελέ, καλώδια).', 'Materials and equipment (e.g. circuit breakers, RCDs, cables).'], ['Εργασίες επέκτασης ή τροποποίησης της εγκατάστασης.', 'Extension or modification of the installation.'], ['Έκδοση νέας ΥΔΕ και εργασίες για αλλαγή παροχής.', 'Issuing a new installer certificate and work for a change of supply.'], ['Αποκατάσταση βλαβών από υπερτάσεις, κεραυνούς ή εξωτερικά αίτια.', 'Repair of damage caused by surges, lightning or external causes.'], ['Επισκέψεις για βλάβη εκτός του προγράμματος, οι οποίες χρεώνονται χωριστά.', 'Call-outs for faults outside the schedule, which are charged separately.']],
    per: ['εγκατάσταση', 'installation'],
  },
  it: {
    label: ['Τεχνικός Η/Υ & δικτύων', 'IT & network services'], mark: 'initials',
    desc: ['Υπολογιστές, εκτυπωτές, δίκτυα, NAS. Δελτία παραλαβής για επισκευές, έλεγχος υγείας στην επίσκεψη, ώρες υποστήριξης.', 'Computers, printers, networks, NAS. Intake receipts for repairs, health checks on each visit, support hours.'],
    eq: { one: ['Συσκευή', 'Device'], many: ['Συσκευές', 'Devices'], a: ['συσκευή', 'device'], as: ['συσκευές', 'devices'], abbr: ['συσκ.', 'dev.'], icon: '⌨', none: ['Δεν υπάρχουν καταχωρημένες συσκευές.', 'No devices registered.'] },
    kinds: [['Επιτραπέζιος υπολογιστής', 'Desktop PC'], ['Φορητός υπολογιστής', 'Laptop'], ['Server', 'Server'], ['Εκτυπωτής / πολυμηχάνημα', 'Printer / MFP'], ['Router / firewall', 'Router / firewall'], ['Switch', 'Switch'], ['Access point', 'Access point'], ['NAS', 'NAS'], ['UPS', 'UPS'], ['Ταμειακή / POS', 'Cash register / POS'], ['Κάμερες / NVR', 'CCTV / NVR'], ['Τηλεφωνικό κέντρο', 'Phone system'], ['Tablet / κινητό', 'Tablet / phone'], ['Άλλο', 'Other']],
    brands: ['HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'Apple', 'MSI', 'Fujitsu', 'Microsoft', 'Samsung', 'Synology', 'QNAP', 'MikroTik', 'Ubiquiti', 'TP-Link', 'Cisco', 'Fortinet', 'Netgear', 'Brother', 'Canon', 'Epson', 'Kyocera', 'Xerox', 'Ricoh', 'APC', 'Eaton', 'Hikvision', 'Dahua'],
    spec: '',
    fields: [
      { k: 'os', l: ['Λειτουργικό / firmware', 'OS / firmware'], type: 'text', ph: 'Windows 11 Pro' },
      { k: 'host', l: ['Όνομα στο δίκτυο / IP', 'Hostname / IP'], type: 'text', ph: 'PC-01 · 192.168.1.20' },
      { k: 'user', l: ['Χρήστης', 'User'], type: 'text', ph: '' },
    ],
    note: ['Μην αποθηκεύετε κωδικούς πρόσβασης εδώ: τα αρχεία είναι απλά κείμενα στον φάκελο.', 'Do not store passwords here: the files are plain text in the folder.'],
    meas: [
      { k: 'upd', l: ['Ενημερώσεις', 'Updates'], short: ['Ενημ.', 'Upd.'], type: 'sel', opts: [['', '—'], ['ok', ['Ενημερωμένο', 'Up to date']], ['warn', ['Εκκρεμούν', 'Pending']]] },
      { k: 'bk', l: ['Αντίγραφα ασφαλείας', 'Backups'], short: ['Αντίγρ.', 'Backup'], type: 'sel', opts: [['', '—'], ['ok', ['Λειτουργούν', 'Working']], ['warn', ['Παλιά', 'Outdated']], ['bad', ['Δεν υπάρχουν', 'None']]] },
      { k: 'disk', l: ['Υγεία δίσκων', 'Disk health'], short: ['Δίσκος', 'Disk'], type: 'sel', opts: YESNO },
      { k: 'av', l: ['Προστασία (antivirus)', 'Protection (antivirus)'], short: ['AV', 'AV'], type: 'sel', opts: [['', '—'], ['ok', ['Ενεργή', 'Active']], ['bad', ['Ανενεργή / έληξε', 'Inactive / expired']]] },
    ],
    measFor: m => true,
    register: 'tickets', regLabel: ['Επισκευές', 'Repairs'], regTitle: ['Επισκευές συσκευών', 'Device repairs'],
    hours: true,
    checklist: mkChecklist([
      ['Υπολογιστές', 'Εγκατάσταση ενημερώσεων λειτουργικού και εφαρμογών', 'Computers', 'Operating system and application updates'], ['Υπολογιστές', 'Έλεγχος προστασίας (antivirus)', 'Computers', 'Protection (antivirus) check'], ['Υπολογιστές', 'Έλεγχος υγείας δίσκων (SMART)', 'Computers', 'Disk health check (SMART)'], ['Υπολογιστές', 'Καθαρισμός προσωρινών αρχείων και σκόνης', 'Computers', 'Cleaning of temporary files and dust'],
      ['Δίκτυο', 'Έλεγχος router / firewall και ενημέρωση firmware', 'Network', 'Router / firewall check and firmware update'], ['Δίκτυο', 'Έλεγχος Wi-Fi και switch', 'Network', 'Wi-Fi and switch check'], ['Δίκτυο', 'Έλεγχος UPS', 'Network', 'UPS check'],
      ['Αντίγραφα ασφαλείας', 'Έλεγχος ότι τα αντίγραφα ολοκληρώνονται', 'Backups', 'Check that backups complete'], ['Αντίγραφα ασφαλείας', 'Δοκιμαστική επαναφορά αρχείου', 'Backups', 'Test restore of a file'],
      ['Αναφορά', 'Ενημέρωση πελάτη για ευρήματα και προτάσεις', 'Report', 'Briefing the client on findings and recommendations']]),
    exclusions: [['Υλικά, ανταλλακτικά και άδειες λογισμικού.', 'Materials, spare parts and software licences.'], ['Ανάκτηση δεδομένων από χαλασμένους δίσκους.', 'Data recovery from failed drives.'], ['Αποκατάσταση από ιούς ή ransomware πέρα από την τακτική συντήρηση.', 'Virus or ransomware recovery beyond routine maintenance.'], ['Εργασίες εκτός προγράμματος ή πέρα από τις ώρες του συμβολαίου, οι οποίες χρεώνονται χωριστά.', 'Work outside the schedule or beyond the hours of the agreement, which is charged separately.']],
    per: ['συσκευή', 'device'],
  },
  general: {
    label: ['Γενική επιχείρηση', 'General business'], mark: 'initials',
    desc: ['Τεχνικές εργασίες, υπηρεσίες, εξοπλισμός πελατών, συμβόλαια συντήρησης.', 'Technical work, services, client equipment, maintenance agreements.'],
    eq: { one: ['Εξοπλισμός', 'Equipment'], many: ['Εξοπλισμός', 'Equipment'], a: ['τεμάχιο εξοπλισμού', 'item of equipment'], as: ['τεμάχια εξοπλισμού', 'items of equipment'], abbr: ['τεμ.', 'items'], icon: '⚙', none: ['Δεν υπάρχει καταχωρημένος εξοπλισμός.', 'No equipment registered.'] },
    kinds: null, brands: [], spec: '', fields: [], meas: [], measFor: () => false, register: '',
    checklist: mkChecklist([
      ['Έλεγχος', 'Οπτικός έλεγχος εξοπλισμού', 'Inspection', 'Visual inspection of equipment'], ['Έλεγχος', 'Έλεγχος καλής λειτουργίας', 'Inspection', 'Operation check'], ['Έλεγχος', 'Έλεγχος ηλεκτρικών συνδέσεων', 'Inspection', 'Check of electrical connections'], ['Έλεγχος', 'Μετρήσεις λειτουργίας', 'Inspection', 'Operating measurements'],
      ['Συντήρηση', 'Καθαρισμός', 'Maintenance', 'Cleaning'], ['Συντήρηση', 'Ρυθμίσεις και λίπανση όπου απαιτείται', 'Maintenance', 'Adjustment and lubrication where needed'],
      ['Αναφορά', 'Καταγραφή παρατηρήσεων και ενημέρωση πελάτη', 'Report', 'Recording observations and briefing the client']]),
    exclusions: [['Ανταλλακτικά και υλικά.', 'Spare parts and materials.'], ['Αποκατάσταση βλαβών από κακή χρήση ή εξωτερικά αίτια.', 'Repair of damage caused by misuse or external causes.'], ['Επισκέψεις για βλάβη εκτός του προγράμματος, οι οποίες χρεώνονται χωριστά.', 'Call-outs for faults outside the schedule, which are charged separately.']],
    per: ['τεμάχιο', 'item'],
  },
};
const PROFILE_ORDER = ['hvac', 'plumb', 'elec', 'it', 'general'];
const profileOf = k => PROFILES[k] || PROFILES.hvac;
const PROF = () => profileOf(DB.settings?.biz);
const isHvac = () => (DB.settings?.biz || 'hvac') === 'hvac';
const eqWords = (P, f) => { const e = P.eq; return { one: f(e.one), many: f(e.many), a: f(e.a), as: f(e.as), abbr: f(e.abbr), icon: e.icon, none: f(e.none) }; };
const EQ = () => eqWords(PROF(), pick2);   // interface words
const DEQ = () => eqWords(PROF(), dpick2); // document words
const pricingLabels = (doc) => { const f = doc ? dpick2 : pick2, p = f(PROF().per); return { visit: f([`Ανά ${p} ανά επίσκεψη`, `Per ${p} per visit`]), year: f([`Ανά ${p} ανά έτος`, `Per ${p} per year`]), total: f(['Συνολικό ποσό', 'Total amount']) }; };
const checklistOf = biz => clone(profileOf(biz).checklist);
const exclusionsOf = (biz, lang) => profileOf(biz).exclusions.map(x => lang === 'en' ? x[1] : x[0]);

/* translations of the built-in texts, used to complete checklists/exclusions saved by older versions */
const BUILTIN_EN = (() => { const m = {}; for (const P of Object.values(PROFILES)) { for (const k of P.checklist) { m[k.t] = k.te; m[k.g] = k.ge; } for (const [a, b] of P.exclusions) m[a] = b; } return m; })();
const KIND_EN = (() => { const m = {}; for (const P of Object.values(PROFILES)) for (const [a, b] of P.kinds || []) m[a] = b; return m; })();
function enrichChecklist(list) { return list.map(k => ({ ...k, ge: k.ge || BUILTIN_EN[k.g] || '', te: k.te || BUILTIN_EN[k.t] || '' })); }
const translateExclusions = arr => arr.map(t => BUILTIN_EN[t] || t);
const kindUI = k => UIL === 'en' ? (KIND_EN[k] || k) : k;
const kindDoc = k => DL === 'en' ? (KIND_EN[k] || k) : k;
const checkText = (k, doc) => (doc ? DL : UIL) === 'en' ? (k.te || k.t) : k.t;
const checkGroup = (k, doc) => (doc ? DL : UIL) === 'en' ? (k.ge || k.g) : k.g;

/* repair tickets (IT profile): default terms printed on the intake receipt */
const TICKET_TERMS = {
  el: ['Ο πελάτης φροντίζει να έχει αντίγραφο ασφαλείας των δεδομένων του. Ο τεχνικός δεν ευθύνεται για απώλεια δεδομένων κατά την επισκευή.', 'Το κόστος είναι ενδεικτικό· το οριστικό δίνεται μετά τη διάγνωση και η επισκευή γίνεται με τη σύμφωνη γνώμη του πελάτη.', 'Η συσκευή παραδίδεται με την επίδειξη του παρόντος δελτίου.'],
  en: ['The client is responsible for keeping a backup of their data. The technician is not liable for data loss during the repair.', 'The cost is an estimate; the final cost is given after diagnosis and the repair is carried out with the client\'s consent.', 'The device is returned on presentation of this receipt.'],
};

/* ------------------------------------------------------------------ equipment description */
function specOf(m, P = PROF()) {
  const f = P.fields.find(x => x.k === P.spec); if (!f || !m[f.k]) return '';
  return f.fmt ? f.fmt(m[f.k]) : m[f.k];
}
/* doc: true → in the current document language */
function machineLabel(m, doc) {
  const P = PROF(), saved = DL; if (!doc) DL = UIL;
  const s = [m.brand, doc ? kindDoc(m.kind) : kindUI(m.kind), specOf(m, P), m.model].filter(Boolean).join(' · ');
  DL = saved; return s;
}
const refKey = v => { v = String(v || '').trim().replace(/^r-?/i, 'R'); return Object.keys(REFRIGERANTS).find(k => k.toLowerCase() === v.toLowerCase()) || v; };
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function parseMachine(t) {
  const P = PROF(); t = String(t || ''); const low = fold(t);
  const brand = (P.brands || []).find(b => low.includes(fold(b))) || '';
  if (isHvac()) {
    const m = t.match(/(\d{1,2}[.,\s]?\d{3})\s*btu/i);
    const kind = /καναλ/i.test(t) ? 'Καναλάτο' : /κασέτ/i.test(t) ? 'Κασέτα' : /δαπέδ|οροφ/i.test(t) ? 'Δαπέδου / Οροφής' : /ντουλ/i.test(t) ? 'Ντουλάπα' : /πολυδιαιρ|multi/i.test(t) ? 'Πολυδιαιρούμενο' : /τοίχ|τοιχ|wall/i.test(t) ? 'Τοίχου' : '';
    const ref = (t.match(/\bR-?(32|410A|134a|407C|290|454B|513A)\b/i) || [])[1];
    return { btu: m ? m[1].replace(/[.,\s]/g, '') : '', brand, kind, ...(ref ? { ref: refKey('R' + ref) } : {}) };
  }
  const kind = (P.kinds || []).map(k => k[0]).find(k => k !== 'Άλλο' && low.includes(fold(k).split(/[\s/]/)[0])) || '';
  const out = { brand, kind };
  if (P.spec === 'kw') { const k = t.match(/(\d+(?:[.,]\d+)?)\s*kw/i); if (k) out.kw = k[1].replace(',', '.'); }
  return out;
}

/* form fields of a profile (used by the equipment dialog and the line dialog) */
function fieldInput(f, v, id) {
  const lab = pick2(f.l);
  if (f.type === 'bool') return `<div class="f" style="align-self:end"><label class="chk"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> ${esc(lab)}</label></div>`;
  if (f.type === 'sel') return `<div class="f"><label for="${id}">${esc(lab)}</label><select id="${id}">${f.opts.map(([k, l]) => `<option value="${k}" ${String(v ?? '') === k ? 'selected' : ''}>${esc(pick2(l))}</option>`).join('')}</select></div>`;
  if (f.type === 'list') return `<div class="f"><label for="${id}">${esc(lab)}</label><input id="${id}" list="${id}-l" value="${esc(v ?? '')}" placeholder="${esc(pick2(f.ph || ''))}"><datalist id="${id}-l">${f.list.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>`;
  return `<div class="f"><label for="${id}">${esc(lab)}</label><input id="${id}" ${f.type === 'date' ? 'type="date"' : ''} ${f.type === 'int' || f.type === 'dec' ? `inputmode="${f.type === 'int' ? 'numeric' : 'decimal'}"` : ''} value="${esc(f.type === 'dec' && v !== '' && v != null ? decStr(v) : v ?? '')}" placeholder="${esc(pick2(f.ph || ''))}"></div>`;
}
function fieldValue(f, el) {
  if (!el) return undefined;
  if (f.type === 'bool') return el.checked;
  const v = el.value.trim();
  if (f.type === 'int') return v.replace(/\D/g, '');
  if (f.type === 'dec') return v === '' ? '' : num(v);
  return v;
}
function kindInput(P, v, id) {
  if (!P.kinds) return `<input id="${id}" value="${esc(v)}" placeholder="${tr('π.χ. λέβητας, αντλία, πίνακας', 'e.g. boiler, pump, panel')}">`;
  const known = P.kinds.some(k => k[0] === v);
  return `<select id="${id}"><option value=""></option>${P.kinds.map(([k, e]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(tr(k, e))}</option>`).join('')}${v && !known ? `<option value="${esc(v)}" selected>${esc(v)}</option>` : ''}</select>`;
}
const brandList = (P, id) => P.brands?.length ? `<datalist id="${id}">${P.brands.map(b => `<option value="${esc(b)}">`).join('')}</datalist>` : '';

async function machineForm(m, { allowDelete } = {}) {
  const P = PROF(), E = EQ();
  m = Object.assign({ brand: '', kind: '', model: '', serial: '', location: '', installed: '', warrantyEnd: '' }, m || {});
  const body = `<div class="form">
    <div class="f"><label for="m-brand">${tr(isHvac() ? 'Μάρκα' : 'Κατασκευαστής', isHvac() ? 'Brand' : 'Manufacturer')}</label><input id="m-brand" list="m-brands" value="${esc(m.brand)}">${brandList(P, 'm-brands')}</div>
    <div class="f"><label for="m-kind">${tr(P.kinds ? 'Τύπος' : 'Περιγραφή / τύπος', P.kinds ? 'Type' : 'Description / type')}</label>${kindInput(P, m.kind, 'm-kind')}</div>
    ${P.fields.map(f => fieldInput(f, m[f.k], 'm-f-' + f.k)).join('')}
    <div class="f"><label for="m-location">${tr('Θέση', 'Location')}</label><input id="m-location" value="${esc(m.location)}" placeholder="${tr('π.χ. σαλόνι', 'e.g. living room')}"></div>
    <div class="f"><label for="m-model">${tr('Μοντέλο', 'Model')}</label><input id="m-model" value="${esc(m.model)}"></div>
    <div class="f"><label for="m-serial">${tr('Σειριακός αριθμός', 'Serial number')}</label><input id="m-serial" value="${esc(m.serial)}"></div>
    <div class="f"><label for="m-installed">${tr('Ημ. εγκατάστασης', 'Installed on')}</label><input id="m-installed" type="date" value="${esc(m.installed)}"></div>
    <div class="f"><label for="m-warranty">${tr('Λήξη εγγύησης', 'Warranty ends')}</label><input id="m-warranty" type="date" value="${esc(m.warrantyEnd)}"></div>
  </div>${P.note ? `<p class="note" style="margin-top:12px">${esc(pick2(P.note))}</p>` : ''}<div id="m-reg"></div>`;
  let vals = null;
  const grab = mb => { const v = id => ($('#' + id, mb)?.value || '').trim();
    vals = { brand: v('m-brand'), kind: v('m-kind'), location: v('m-location'), model: v('m-model'), serial: v('m-serial'), installed: v('m-installed'), warrantyEnd: v('m-warranty') };
    for (const f of P.fields) vals[f.k] = fieldValue(f, $('#m-f-' + f.k, mb));
    if ('ref' in vals) vals.ref = vals.ref ? refKey(vals.ref) : '';
    return true; };
  const res = await modal({ title: allowDelete ? E.one : tr(isHvac() ? 'Νέο μηχάνημα' : 'Νέα καταχώριση', isHvac() ? 'New unit' : 'New entry') + (allowDelete ? '' : ' · ' + E.one), body, wide: P.fields.length > 2,
    actions: [...(allowDelete ? [{ label: tr('Διαγραφή', 'Delete'), value: 'delete', cls: 'danger' }, '|'] : []), { label: tr('Άκυρο', 'Cancel'), value: null }, { label: tr('Αποθήκευση', 'Save'), value: 'save', cls: 'blue', validate: grab }],
    onOpen: mb => {
      const ins = $('#m-installed', mb), w = $('#m-warranty', mb); ins.onchange = () => { const wm = num(DB.settings.defaults.warrantyMonths); if (ins.value && !w.value && wm) w.value = addMonths(ins.value, wm); };
      const ref = $('#m-f-ref', mb), gwp = $('#m-f-gwp', mb);
      if (ref && gwp) { const sync = () => { const g = REFRIGERANTS[refKey(ref.value)]; gwp.placeholder = g ? String(g.gwp) : tr('από το ψυκτικό', 'from refrigerant'); }; ref.oninput = sync; sync(); }
    } });
  if (res !== 'save') return res;
  return Object.assign(m, vals);
}

/* ------------------------------------------------------------------ measurements recorded on visits */
const measList = () => PROF().meas || [];
const hasMeas = m => measList().length && PROF().measFor(m);
const measFilled = ms => ms && Object.values(ms).some(v => v !== '' && v != null);
function measShow(f, v, doc) {
  if (v === '' || v == null) return '';
  const pick = doc ? dpick2 : pick2;
  if (f.type === 'sel') { const o = f.opts.find(x => x[0] === v); return o ? pick(o[1]) : v; }
  return (doc ? dpct(v) : decStr(v)) + (f.u ? ' ' + f.u : '');
}
function measText(ms, doc) {
  if (!measFilled(ms)) return '';
  const pick = doc ? dpick2 : pick2;
  return measList().filter(f => ms[f.k] !== '' && ms[f.k] != null).map(f => f.type === 'sel' ? `${pick(f.short || f.l)}: ${measShow(f, ms[f.k], doc)}` : `${pick(f.short || f.l)} ${measShow(f, ms[f.k], doc)}`).join(' · ');
}
function measInputs(ms, key) {
  ms = ms || {};
  return `<div class="meas">${measList().map(f => f.type === 'sel'
    ? `<label><span>${esc(pick2(f.short || f.l))}</span><select data-ms="${key}" data-mk="${f.k}" title="${esc(pick2(f.l))}">${f.opts.map(([k, l]) => `<option value="${k}" ${String(ms[f.k] ?? '') === k ? 'selected' : ''}>${esc(pick2(l))}</option>`).join('')}</select></label>`
    : `<label><span>${esc(pick2(f.short || f.l))}</span><input data-ms="${key}" data-mk="${f.k}" inputmode="decimal" value="${esc(ms[f.k] !== '' && ms[f.k] != null ? decStr(ms[f.k]) : '')}" placeholder="${esc(f.u || '')}" title="${esc(pick2(f.l))}"></label>`).join('')}</div>`;
}
function measGrab(root, key) {
  const out = {};
  for (const f of measList()) { const el = $(`[data-ms="${key}"][data-mk="${f.k}"]`, root); if (!el) continue; const v = el.value.trim(); out[f.k] = f.type === 'sel' ? v : (v === '' ? '' : num(v)); }
  return out;
}

/* ------------------------------------------------------------------ register of periodic checks */
/* every event of a unit: manual entries + measurements from the visit logs of its contracts */
function machineEvents(m) {
  const ev = (m.log || []).map(l => ({ ...l, src: 'manual' }));
  for (const d of DB.docs) {
    if (d.type !== 'contract' || !d.issued || d.cancelled) continue;
    for (const l of d.visitLog || []) { const x = (l.machines || []).find(y => y.id === m.id); if (x && measFilled(x.ms)) ev.push({ id: l.id, date: l.date, ms: x.ms, note: x.note, tech: l.tech, src: 'visit', doc: d.id, no: d.no }); }
  }
  return ev.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
function fgasInfo(m) {
  const g = REFRIGERANTS[refKey(m.ref)] || null, gwp = num(m.gwp) || g?.gwp || 0, cls = g?.cls || (m.ref ? 'hfc' : ''), kg = num(m.charge);
  const co2 = Math.round(kg * gwp) / 1000; let need = false, freq = 0;
  if (cls === 'hfc') { need = co2 >= 5 && !(m.hermetic && co2 < 10); freq = co2 >= 500 ? 3 : co2 >= 50 ? 6 : 12; }
  else if (cls === 'hfo') { need = kg >= 1 && !(m.hermetic && kg < 2); freq = kg >= 100 ? 3 : kg >= 10 ? 6 : 12; }
  if (need && m.lds) freq *= 2;
  return { gwp, cls, kg, co2, need, freq };
}
function regRow(c, m) {
  const P = PROF(), ev = machineEvents(m);
  if (P.register === 'fgas') {
    if (!m.ref) return null;
    const f = fgasInfo(m), last = ev.find(e => e.ms && e.ms.leak);
    const next = f.need ? (last ? addMonths(last.date, f.freq) : m.installed ? addMonths(m.installed, f.freq) : todayISO()) : '';
    return { c, m, ev, last, next, f };
  }
  if (P.register === 'combustion') {
    if (!P.measFor(m)) return null;
    const freq = num(DB.settings.regMonths.combustion) || 12, last = ev.find(e => measFilled(e.ms));
    return { c, m, ev, last, next: last ? addMonths(last.date, freq) : m.installed ? addMonths(m.installed, freq) : todayISO(), f: { freq } };
  }
  if (P.register === 'inspection') {
    const last = ev.find(e => measFilled(e.ms));
    return { c, m, ev, last, next: m.nextInsp || '', f: {} };
  }
  return null;
}
const regRows = () => PROF().register && PROF().register !== 'tickets' ? DB.clients.flatMap(c => c.machines.map(m => regRow(c, m)).filter(Boolean)) : [];
function dueChip(next) {
  if (!next) return '<span class="chip">—</span>';
  const left = daysBetween(todayISO(), next);
  if (left < 0) return `<span class="chip bad">${tr('Εκπρόθεσμος', 'Overdue')} · ${fmtDate(next)}</span>`;
  if (left <= 30) return `<span class="chip warn">${tr('Έως', 'By')} ${fmtDate(next)}</span>`;
  return `<span class="chip ok">${tr('Έως', 'By')} ${fmtDate(next)}</span>`;
}
const regDue = () => regRows().filter(r => r.next && daysBetween(todayISO(), r.next) <= 30);
const regWhat = () => ({ fgas: tr('Έλεγχος διαρροής', 'Leak check'), combustion: tr('Έλεγχος καύσης', 'Combustion check'), inspection: tr('Επανέλεγχος', 'Re-inspection') }[PROF().register] || '');
