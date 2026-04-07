"""Smoke tests for the HTML validator (HTML-first model)."""

from app.core.html_validator import validate_html

# Test 1: Valid report
e1 = validate_html("<h2>Title</h2><p>Hello world, this is a valid report.</p>")
assert e1 == [], f"Expected no errors, got: {e1}"
print("PASS: Valid report")

# Test 2: Empty body rejected
e2 = validate_html("")
assert any("empty" in e.lower() for e in e2), f"Expected empty error, got: {e2}"
print("PASS: Empty body rejected")

# Test 3: Whitespace-only rejected
e3 = validate_html("   \n\t  ")
assert any("empty" in e.lower() for e in e3), f"Expected empty error, got: {e3}"
print("PASS: Whitespace-only rejected")

# Test 4: Insufficient text content
e4 = validate_html("<div>Hi</div>")
assert any("insufficient" in e.lower() for e in e4), f"Expected insufficient error, got: {e4}"
print("PASS: Insufficient text rejected")

# Test 5: Scripts are allowed (sandboxed iframe model)
e5 = validate_html('<script>console.log("hello")</script><h2>Title</h2><p>This is a valid report with scripts.</p>')
assert e5 == [], f"Expected no errors (scripts allowed), got: {e5}"
print("PASS: Scripts allowed")

# Test 6: Style tags are allowed
e6 = validate_html("<style>h1 { color: red }</style><h2>Title</h2><p>This is a valid report with styles.</p>")
assert e6 == [], f"Expected no errors (style allowed), got: {e6}"
print("PASS: Style tags allowed")

# Test 7: Iframes are allowed
e7 = validate_html('<iframe src="https://example.com"></iframe><h2>Title</h2><p>This is a valid report with iframes.</p>')
assert e7 == [], f"Expected no errors (iframes allowed), got: {e7}"
print("PASS: Iframes allowed")

# Test 8: Full HTML document
e8 = validate_html('<!DOCTYPE html><html><head><style>body{color:red}</style></head><body><h1>Report</h1><p>Full document is fine.</p></body></html>')
assert e8 == [], f"Expected no errors, got: {e8}"
print("PASS: Full HTML document valid")

# Test 9: Oversized body rejected
big = "<p>" + "x" * (2 * 1024 * 1024) + "</p>"
e9 = validate_html(big)
assert any("exceeds" in e.lower() or "limit" in e.lower() for e in e9), f"Expected size error, got: {e9}"
print("PASS: Oversized body rejected")

print("\nAll 9 tests passed!")
