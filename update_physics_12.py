import re

html_file = 'Notes/notes-physics-class12.html'
with open(html_file, 'r') as f:
    content = f.read()

ch1_content = """
        <p class="chapter-summary">A foundational chapter dealing with electric charges, Coulomb's Law, and electric fields.</p>

        <h3><i class="fas fa-bullseye"></i> Learning Objectives</h3>
        <ul>
          <li>Understand the properties of electric charge.</li>
          <li>Apply Coulomb's Law to calculate the force between point charges.</li>
          <li>Calculate electric field due to point charges and continuous charge distributions.</li>
          <li>Understand Gauss's Law and its applications.</li>
        </ul>

        <h3><i class="fas fa-lightbulb"></i> Key Concepts</h3>
        <ul>
          <li><strong>Quantization of Charge:</strong> Charge exists in discrete packets (q = ne).</li>
          <li><strong>Coulomb's Law:</strong> The electrostatic force is proportional to the product of charges and inversely proportional to the square of the distance between them.</li>
          <li><strong>Electric Field:</strong> Force experienced by a unit positive charge placed in the field.</li>
          <li><strong>Electric Dipole:</strong> A pair of equal and opposite charges separated by a small distance.</li>
        </ul>

        <div class="derivation-box">
          <h3><i class="fas fa-calculator"></i> Gauss's Law</h3>
          <p>The total electric flux through a closed surface is equal to 1/ε₀ times the net charge enclosed by the surface.</p>
          <p>Φ = ∮ E · dA = q_enclosed / ε₀</p>
        </div>
"""

ch2_content = """
        <p class="chapter-summary">Deals with the concept of electric potential, potential energy, and capacitors.</p>

        <h3><i class="fas fa-bullseye"></i> Learning Objectives</h3>
        <ul>
          <li>Understand electric potential and potential difference.</li>
          <li>Calculate potential due to a point charge and a dipole.</li>
          <li>Understand capacitance and dielectrics.</li>
          <li>Calculate the energy stored in a capacitor.</li>
        </ul>

        <h3><i class="fas fa-lightbulb"></i> Key Concepts</h3>
        <ul>
          <li><strong>Electric Potential:</strong> Work done per unit charge in bringing a test charge from infinity to a point.</li>
          <li><strong>Equipotential Surface:</strong> A surface over which the electric potential is constant.</li>
          <li><strong>Capacitance:</strong> The ability of a system to store electric charge (C = Q/V).</li>
        </ul>

        <div class="derivation-box">
          <h3><i class="fas fa-calculator"></i> Capacitance of a Parallel Plate Capacitor</h3>
          <p>For a parallel plate capacitor with plate area A and separation d:</p>
          <p>C = ε₀A / d</p>
          <p>When a dielectric of constant K is introduced, C' = K · ε₀A / d = K · C</p>
        </div>
"""

# Replace the coming soon sections
content = re.sub(r'(<section id="ch1" class="chapter-section">\s*<h2>Chapter 1: Electric Charges and Fields</h2>\s*)<div class="coming-soon-section">.*?</div>', r'\1' + ch1_content, content, flags=re.DOTALL)
content = re.sub(r'(<section id="ch2" class="chapter-section">\s*<h2>Chapter 2: Electrostatic Potential and Capacitance</h2>\s*)<div class="coming-soon-section">.*?</div>', r'\1' + ch2_content, content, flags=re.DOTALL)

with open(html_file, 'w') as f:
    f.write(content)
