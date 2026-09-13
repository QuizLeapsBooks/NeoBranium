import os
import re

# We will read class-wise-notes.html as a template
with open('Notes/class-wise-notes.html', 'r', encoding='utf-8') as f:
    template = f.read()

# We need to replace the chapters array, the hero text, and the title.
# In createChapterCard, we'll replace the footer to handle coming soon.

def create_dir(filename, title, hero_title, hero_subtitle, chapters_js, subject):
    content = template
    
    # 1. Title
    content = re.sub(r'<title>.*?</title>', f'<title>{title} | NeoBranium</title>', content)
    
    # 2. Hero
    content = re.sub(r'<h1 class="animate__animated animate__fadeInDown">.*?</h1>', f'<h1 class="animate__animated animate__fadeInDown">{hero_title}</h1>', content)
    content = re.sub(r'<p class="animate__animated animate__fadeInUp animate__delay-1s".*?>.*?</p>', f'<p class="animate__animated animate__fadeInUp animate__delay-1s">{hero_subtitle}</p>', content)
    
    # 3. Chapters JS
    # We find 'const chapters = [' and replace the array.
    pattern = r'const chapters = \[.*?\];'
    content = re.sub(pattern, f'const chapters = {chapters_js};', content, flags=re.DOTALL)
    
    # 4. Modify createChapterCard
    old_card = r"""<span class="read-link"><i class="fas fa-eye"></i> Read Full Notes <i class="fas fa-arrow-right"></i></span>"""
    new_card = r"""${chapter.url === '#' ? '<span class="read-link" style="color:#94a3b8;"><i class="fas fa-lock"></i> Coming Soon</span>' : '<span class="read-link"><i class="fas fa-eye"></i> Read Full Notes <i class="fas fa-arrow-right"></i></span>'}"""
    content = content.replace(old_card, new_card)
    
    # Hide biology/chemistry/physics grids if not needed
    if subject == 'Maths':
        content = content.replace("document.getElementById('chemistry-section').style.display = 'block';", "")
        content = content.replace("document.getElementById('biology-section').style.display = 'block';", "")
        content = content.replace("document.getElementById('physics-section').style.display = 'block';", "document.getElementById('maths-section').style.display = 'block';")
        content = content.replace('<h2 class="chemistry-icon">Chemistry</h2>', '<h2 class="physics-icon">Mathematics</h2>')
        content = content.replace('id="chemistry-section"', 'id="maths-section" class="subject-section"')
        content = content.replace('id="chemistry-grid"', 'id="maths-grid"')
        content = content.replace('chemistryGrid.appendChild(card)', 'document.getElementById("maths-grid").appendChild(card)')
        
        # also remove biology and physics sections from HTML
        content = re.sub(r'<div id="biology-section".*?</div>\s*</div>\s*</div>', '', content, flags=re.DOTALL)
        content = re.sub(r'<div id="physics-section".*?</div>\s*</div>\s*</div>', '', content, flags=re.DOTALL)
    else:
        # Just use chemistry section as generic section for single subject
        content = content.replace('<h2 class="chemistry-icon">Chemistry</h2>', f'<h2 class="chemistry-icon">{subject}</h2>')
        content = content.replace('chemistryGrid.appendChild(card)', 'document.getElementById("chemistry-grid").appendChild(card)')
        content = re.sub(r'<div id="biology-section".*?</div>\s*</div>\s*</div>', '', content, flags=re.DOTALL)
        content = re.sub(r'<div id="physics-section".*?</div>\s*</div>\s*</div>', '', content, flags=re.DOTALL)

    with open(f'Notes/{filename}', 'w', encoding='utf-8') as f:
        f.write(content)


class9_science_js = """[
    { id: 1, number: 1, title: "Matter in Our Surroundings", subject: "Science", url: "#", topics: ["States of Matter", "Evaporation"], description: "Physical nature of matter and states." },
    { id: 2, number: 2, title: "Is Matter Around Us Pure", subject: "Science", url: "#", topics: ["Mixtures", "Solutions"], description: "Types of mixtures and separation." },
    { id: 3, number: 3, title: "Atoms and Molecules", subject: "Science", url: "#", topics: ["Atoms", "Molecules"], description: "Laws of chemical combination." },
    { id: 4, number: 4, title: "Structure of the Atom", subject: "Science", url: "#", topics: ["Electrons", "Protons", "Neutrons"], description: "Atomic models and subatomic particles." },
    { id: 5, number: 5, title: "The Fundamental Unit of Life", subject: "Science", url: "#", topics: ["Cell", "Organelles"], description: "Cell structure and functions." },
    { id: 6, number: 6, title: "Tissues", subject: "Science", url: "#", topics: ["Plant Tissues", "Animal Tissues"], description: "Different types of tissues." },
    { id: 7, number: 7, title: "Motion", subject: "Science", url: "#", topics: ["Speed", "Velocity", "Acceleration"], description: "Describing motion in a straight line." },
    { id: 8, number: 8, title: "Force and Laws of Motion", subject: "Science", url: "#", topics: ["Newton's Laws", "Momentum"], description: "Forces and how they cause motion." },
    { id: 9, number: 9, title: "Gravitation", subject: "Science", url: "#", topics: ["Gravity", "Buoyancy"], description: "Universal law of gravitation." },
    { id: 10, number: 10, title: "Work and Energy", subject: "Science", url: "#", topics: ["Work", "Energy", "Power"], description: "Scientific conception of work." }
]"""

class9_maths_js = """[
    { id: 1, number: 1, title: "Number Systems", subject: "Mathematics", url: "#", topics: ["Rational", "Irrational"], description: "Real numbers and their decimal expansions." },
    { id: 2, number: 2, title: "Polynomials", subject: "Mathematics", url: "#", topics: ["Remainder Theorem", "Factorization"], description: "Polynomials in one variable." },
    { id: 3, number: 3, title: "Coordinate Geometry", subject: "Mathematics", url: "#", topics: ["Cartesian Plane", "Coordinates"], description: "Introduction to coordinate geometry." },
    { id: 4, number: 4, title: "Linear Equations", subject: "Mathematics", url: "#", topics: ["Two Variables", "Graph"], description: "Linear equations in two variables." },
    { id: 5, number: 5, title: "Lines and Angles", subject: "Mathematics", url: "#", topics: ["Intersecting", "Parallel"], description: "Basic terms and properties of angles." },
    { id: 6, number: 6, title: "Triangles", subject: "Mathematics", url: "#", topics: ["Congruence", "Inequalities"], description: "Properties of triangles." },
    { id: 7, number: 7, title: "Quadrilaterals", subject: "Mathematics", url: "#", topics: ["Parallelogram", "Properties"], description: "Types and properties of quadrilaterals." },
    { id: 8, number: 8, title: "Circles", subject: "Mathematics", url: "#", topics: ["Chords", "Arcs"], description: "Properties of circles." }
]"""

class10_maths_js = """[
    { id: 1, number: 1, title: "Real Numbers", subject: "Mathematics", url: "#", topics: ["Euclid's Division", "Irrationality"], description: "Fundamental Theorem of Arithmetic." },
    { id: 2, number: 2, title: "Polynomials", subject: "Mathematics", url: "#", topics: ["Zeroes", "Coefficients"], description: "Geometrical meaning of zeroes." },
    { id: 3, number: 3, title: "Pair of Linear Equations", subject: "Mathematics", url: "#", topics: ["Substitution", "Elimination"], description: "Algebraic and graphical methods." },
    { id: 4, number: 4, title: "Quadratic Equations", subject: "Mathematics", url: "#", topics: ["Roots", "Discriminant"], description: "Solving quadratic equations." },
    { id: 5, number: 5, title: "Arithmetic Progressions", subject: "Mathematics", url: "#", topics: ["nth Term", "Sum"], description: "Patterns and sequences." },
    { id: 6, number: 6, title: "Triangles", subject: "Mathematics", url: "#", topics: ["Similarity", "Pythagoras"], description: "Similar triangles and theorems." },
    { id: 7, number: 7, title: "Coordinate Geometry", subject: "Mathematics", url: "#", topics: ["Distance Formula", "Section Formula"], description: "Distance and section formulas." },
    { id: 8, number: 8, title: "Introduction to Trigonometry", subject: "Mathematics", url: "#", topics: ["Ratios", "Identities"], description: "Trigonometric ratios and identities." }
]"""

class11_physics_js = """[
    { id: 1, number: 1, title: "Units and Measurements", subject: "Physics", url: "#", topics: ["SI Units", "Errors"], description: "Fundamental and derived units." },
    { id: 2, number: 2, title: "Motion in a Straight Line", subject: "Physics", url: "#", topics: ["Kinematics", "Graphs"], description: "Uniformly accelerated motion." },
    { id: 3, number: 3, title: "Motion in a Plane", subject: "Physics", url: "#", topics: ["Vectors", "Projectiles"], description: "Scalars and vectors." },
    { id: 4, number: 4, title: "Laws of Motion", subject: "Physics", url: "#", topics: ["Newton's Laws", "Friction"], description: "Dynamics of particles." },
    { id: 5, number: 5, title: "Work, Energy and Power", subject: "Physics", url: "#", topics: ["Kinetic Energy", "Collisions"], description: "Work-energy theorem." }
]"""

class11_chemistry_js = """[
    { id: 1, number: 1, title: "Some Basic Concepts of Chemistry", subject: "Chemistry", url: "#", topics: ["Mole Concept", "Stoichiometry"], description: "Laws of chemical combination." },
    { id: 2, number: 2, title: "Structure of Atom", subject: "Chemistry", url: "#", topics: ["Bohr Model", "Quantum Mechanics"], description: "Discovery of subatomic particles." },
    { id: 3, number: 3, title: "Classification of Elements", subject: "Chemistry", url: "#", topics: ["Periodic Table", "Trends"], description: "Periodicity in properties." },
    { id: 4, number: 4, title: "Chemical Bonding", subject: "Chemistry", url: "#", topics: ["VSEPR", "Hybridization"], description: "Molecular structure." },
    { id: 5, number: 5, title: "Thermodynamics", subject: "Chemistry", url: "#", topics: ["Enthalpy", "Entropy"], description: "Laws of thermodynamics." }
]"""

class11_maths_js = """[
    { id: 1, number: 1, title: "Sets", subject: "Mathematics", url: "#", topics: ["Subsets", "Venn Diagrams"], description: "Types of sets and operations." },
    { id: 2, number: 2, title: "Relations and Functions", subject: "Mathematics", url: "#", topics: ["Domain", "Range"], description: "Cartesian product of sets." },
    { id: 3, number: 3, title: "Trigonometric Functions", subject: "Mathematics", url: "#", topics: ["Radian", "Degree"], description: "Trigonometric equations." },
    { id: 4, number: 4, title: "Complex Numbers", subject: "Mathematics", url: "#", topics: ["Argand Plane", "Polar Form"], description: "Algebra of complex numbers." },
    { id: 5, number: 5, title: "Linear Inequalities", subject: "Mathematics", url: "#", topics: ["Graphical Solution", "Algebraic"], description: "Solving inequalities." }
]"""

class12_physics_js = """[
    { id: 1, number: 1, title: "Electric Charges and Fields", subject: "Physics", url: "#", topics: ["Coulomb's Law", "Gauss's Law"], description: "Electrostatics and fields." },
    { id: 2, number: 2, title: "Electrostatic Potential and Capacitance", subject: "Physics", url: "#", topics: ["Potential", "Capacitors"], description: "Energy in a capacitor." },
    { id: 3, number: 3, title: "Current Electricity", subject: "Physics", url: "#", topics: ["Ohm's Law", "Kirchhoff's Laws"], description: "Electric current and resistance." },
    { id: 4, number: 4, title: "Moving Charges and Magnetism", subject: "Physics", url: "#", topics: ["Biot-Savart Law", "Ampere's Law"], description: "Magnetic force and fields." },
    { id: 5, number: 5, title: "Magnetism and Matter", subject: "Physics", url: "#", topics: ["Earth's Magnetism", "Materials"], description: "Magnetic properties." }
]"""

class12_chemistry_js = """[
    { id: 1, number: 1, title: "Solutions", subject: "Chemistry", url: "#", topics: ["Raoult's Law", "Colligative Properties"], description: "Types of solutions." },
    { id: 2, number: 2, title: "Electrochemistry", subject: "Chemistry", url: "#", topics: ["Nernst Equation", "Batteries"], description: "Electrochemical cells." },
    { id: 3, number: 3, title: "Chemical Kinetics", subject: "Chemistry", url: "#", topics: ["Rate Law", "Activation Energy"], description: "Rate of reaction." },
    { id: 4, number: 4, title: "d and f Block Elements", subject: "Chemistry", url: "#", topics: ["Transition Elements", "Lanthanoids"], description: "Properties of d and f block." },
    { id: 5, number: 5, title: "Coordination Compounds", subject: "Chemistry", url: "#", topics: ["Nomenclature", "Isomerism"], description: "Bonding in coordination compounds." }
]"""

class12_maths_js = """[
    { id: 1, number: 1, title: "Relations and Functions", subject: "Mathematics", url: "#", topics: ["Equivalence", "Invertible"], description: "Types of relations." },
    { id: 2, number: 2, title: "Inverse Trigonometric Functions", subject: "Mathematics", url: "#", topics: ["Principal Value", "Properties"], description: "Domain and range." },
    { id: 3, number: 3, title: "Matrices", subject: "Mathematics", url: "#", topics: ["Operations", "Inverse"], description: "Types of matrices." },
    { id: 4, number: 4, title: "Determinants", subject: "Mathematics", url: "#", topics: ["Adjoint", "System of Equations"], description: "Properties of determinants." },
    { id: 5, number: 5, title: "Continuity and Differentiability", subject: "Mathematics", url: "#", topics: ["Derivatives", "Mean Value Theorem"], description: "Continuity of a function." }
]"""

create_dir('class9-science-dir.html', 'Class 9 Science Notes Directory', 'Class 9 Science Notes Directory', 'Complete chapter-wise notes directory for Class 9 Science.', class9_science_js, 'Science')
create_dir('class9-maths-dir.html', 'Class 9 Mathematics Notes Directory', 'Class 9 Mathematics Notes Directory', 'Complete chapter-wise notes directory for Class 9 Mathematics.', class9_maths_js, 'Mathematics')
create_dir('class10-maths-dir.html', 'Class 10 Mathematics Notes Directory', 'Class 10 Mathematics Notes Directory', 'Complete chapter-wise notes directory for Class 10 Mathematics.', class10_maths_js, 'Mathematics')
create_dir('class11-physics-dir.html', 'Class 11 Physics Notes Directory', 'Class 11 Physics Notes Directory', 'Complete chapter-wise notes directory for Class 11 Physics.', class11_physics_js, 'Physics')
create_dir('class11-chemistry-dir.html', 'Class 11 Chemistry Notes Directory', 'Class 11 Chemistry Notes Directory', 'Complete chapter-wise notes directory for Class 11 Chemistry.', class11_chemistry_js, 'Chemistry')
create_dir('class11-maths-dir.html', 'Class 11 Mathematics Notes Directory', 'Class 11 Mathematics Notes Directory', 'Complete chapter-wise notes directory for Class 11 Mathematics.', class11_maths_js, 'Mathematics')
create_dir('class12-physics-dir.html', 'Class 12 Physics Notes Directory', 'Class 12 Physics Notes Directory', 'Complete chapter-wise notes directory for Class 12 Physics.', class12_physics_js, 'Physics')
create_dir('class12-chemistry-dir.html', 'Class 12 Chemistry Notes Directory', 'Class 12 Chemistry Notes Directory', 'Complete chapter-wise notes directory for Class 12 Chemistry.', class12_chemistry_js, 'Chemistry')
create_dir('class12-maths-dir.html', 'Class 12 Mathematics Notes Directory', 'Class 12 Mathematics Notes Directory', 'Complete chapter-wise notes directory for Class 12 Mathematics.', class12_maths_js, 'Mathematics')
print("Directories generated successfully.")
