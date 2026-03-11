"""Quick smoke test for the HTML validator."""
from app.core.html_validator import validate_html

# Test 1: Valid report
e1 = validate_html("<h2>Title</h2><p>Hello world</p>")
assert e1 == [], f"Expected no errors, got: {e1}"
print("PASS: Valid report")

# Test 2: iframe rejected
e2 = validate_html('<iframe src="evil.com"></iframe><h2>Title</h2>')
assert any("iframe" in e.lower() for e in e2), f"Expected iframe error, got: {e2}"
print("PASS: iframe rejected")

# Test 3: Global style rejected
e3 = validate_html("<style>h1 { color: red }</style><h2>Title</h2>")
assert any("style" in e.lower() for e in e3), f"Expected style error, got: {e3}"
print("PASS: <style> rejected")

# Test 4: position fixed rejected
e4 = validate_html('<div style="position: fixed;"><h2>Title</h2></div>')
assert any("fixed" in e.lower() for e in e4), f"Expected fixed error, got: {e4}"
print("PASS: position:fixed rejected")

# Test 5: Valid slideshow
e5 = validate_html("<section><h2>Slide 1</h2></section><section><h2>Slide 2</h2></section>", content_type="slideshow")
assert e5 == [], f"Expected no errors, got: {e5}"
print("PASS: Valid slideshow")

# Test 6: Slideshow with 1 section
e6 = validate_html("<section><h2>Only one</h2></section>", content_type="slideshow")
assert any("at least 2" in e for e in e6), f"Expected 2-section error, got: {e6}"
print("PASS: 1-section slideshow rejected")

# Test 7: Empty body
e7 = validate_html("")
assert any("empty" in e.lower() for e in e7), f"Expected empty error, got: {e7}"
print("PASS: Empty body rejected")

# Test 8: Evil script CDN
e8 = validate_html('<script src="https://evil.com/hack.js"></script><h2>Title</h2>')
assert any("not allowed" in e.lower() for e in e8), f"Expected script error, got: {e8}"
print("PASS: Evil CDN script rejected")

# Test 9: Allowed CDN
e9 = validate_html('<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script><h2>Title</h2>')
assert e9 == [], f"Expected no errors, got: {e9}"
print("PASS: Chart.js CDN allowed")

print("\nAll 9 tests passed!")
