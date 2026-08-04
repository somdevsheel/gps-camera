package com.gpslocationcamera

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import androidx.exifinterface.media.ExifInterface
import java.io.File
import kotlin.math.max
import kotlin.math.min

/** One rendered row of the stamp. */
data class StampTextLine(val label: String?, val value: String, val emphasis: String)

data class StampSpec(
  val title: String,
  val lines: List<StampTextLine>,
  val position: String,
  val textScale: Float,
  val accentColor: Int,
  val mapImagePath: String?,
  val logoPath: String?,
  val verified: Boolean,
)

/**
 * Draws the location stamp directly onto the photo's pixels, as a headline
 * card: a rounded map thumbnail on one side, a bold place-name headline next
 * to it, the full address and coordinates underneath, and a small app-brand
 * watermark chip tucked in the opposite corner of the photo - the layout
 * used by this whole genre of GPS field-camera apps.
 *
 * Every dimension is derived from the source image width, so the same spec
 * produces a proportionally identical stamp on a 2 MP and a 48 MP capture. The
 * overlay is composited over the photo rather than extending the canvas, which
 * keeps the exported aspect ratio identical to what the camera produced.
 */
object StampRenderer {

  /** Body text height as a fraction of image width, before the user's scale. */
  private const val BASE_TEXT_RATIO = 0.021f
  private const val MIN_TEXT_PX = 14f
  private const val PADDING_RATIO = 0.024f
  private const val LINE_SPACING = 1.3f
  /** The stamp is never allowed to swallow more than this share of the photo. */
  private const val MAX_PANEL_FRACTION = 0.42f
  /** Relative sizes of each emphasis, against the base body text size. */
  private const val HEADLINE_SCALE = 1.7f
  private const val STRONG_SCALE = 1.1f
  private const val NORMAL_SCALE = 1f
  private const val MUTED_SCALE = 0.86f
  /** Extra breathing room under the headline before the detail rows start. */
  private const val HEADLINE_GAP_SCALE = 0.4f

  fun decodeUpright(path: String): Bitmap? {
    val options = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
    val decoded = BitmapFactory.decodeFile(path, options) ?: return null
    return applyExifRotation(decoded, path)
  }

  /**
   * CameraX writes the orientation as an EXIF flag rather than rotating pixels.
   * The stamp has to be drawn in the final viewing orientation, so the rotation
   * is baked in before compositing.
   */
  private fun applyExifRotation(bitmap: Bitmap, path: String): Bitmap {
    val orientation =
      try {
        ExifInterface(path)
          .getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
      } catch (_: Exception) {
        ExifInterface.ORIENTATION_NORMAL
      }

    val matrix = android.graphics.Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
      else -> return bitmap
    }
    return try {
      val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
      if (rotated != bitmap) {
        bitmap.recycle()
      }
      rotated
    } catch (_: OutOfMemoryError) {
      bitmap
    }
  }

  fun draw(source: Bitmap, spec: StampSpec): Bitmap {
    val target =
      if (source.isMutable) source
      else source.copy(Bitmap.Config.ARGB_8888, true) ?: source

    val canvas = Canvas(target)
    val width = target.width.toFloat()
    val height = target.height.toFloat()

    var textSize = max(MIN_TEXT_PX, width * BASE_TEXT_RATIO * spec.textScale)
    val padding = width * PADDING_RATIO

    val bodyPaint = textPaint(Color.WHITE, Typeface.NORMAL)
    val strongPaint = textPaint(Color.WHITE, Typeface.BOLD)
    val mutedPaint = textPaint(Color.parseColor("#C9D1DC"), Typeface.NORMAL)
    val headlinePaint = textPaint(Color.WHITE, Typeface.BOLD)
    val labelPaint = textPaint(Color.parseColor("#9AA3B2"), Typeface.NORMAL)

    val mapBitmap = spec.mapImagePath?.let { loadBitmap(it) }
    val logoBitmap = spec.logoPath?.let { loadBitmap(it) }
    // Reserve room for the verified badge / custom logo only on the row that
    // shares their baseline (the first row), so later rows use full width.
    val cornerReserve = if (spec.verified || logoBitmap != null) width * 0.24f else 0f

    // Lay the text out, shrinking once if the panel would dominate the photo.
    var layout =
      layoutRows(spec, textSize, width, padding, mapBitmap != null, cornerReserve, bodyPaint, mutedPaint, strongPaint, headlinePaint)
    val maxPanelHeight = height * MAX_PANEL_FRACTION
    if (layout.panelHeight > maxPanelHeight) {
      val shrink = maxPanelHeight / layout.panelHeight
      textSize = max(MIN_TEXT_PX, textSize * shrink)
      layout =
        layoutRows(spec, textSize, width, padding, mapBitmap != null, cornerReserve, bodyPaint, mutedPaint, strongPaint, headlinePaint)
    }

    val panelHeight = min(layout.panelHeight, maxPanelHeight)
    val panelTop = if (spec.position == "top") 0f else height - panelHeight
    val panelBottom = panelTop + panelHeight

    // Background
    val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(196, 8, 10, 14) }
    canvas.drawRect(RectF(0f, panelTop, width, panelBottom), backgroundPaint)

    // Accent rule along the panel edge facing the photo
    val accentPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = spec.accentColor }
    val accentThickness = max(2f, width * 0.004f)
    if (spec.position == "top") {
      canvas.drawRect(RectF(0f, panelBottom - accentThickness, width, panelBottom), accentPaint)
    } else {
      canvas.drawRect(RectF(0f, panelTop, width, panelTop + accentThickness), accentPaint)
    }

    // Map thumbnail, left-aligned with rounded corners
    var contentLeft = padding
    val contentRight = width - padding
    if (mapBitmap != null) {
      val size = panelHeight - padding * 2
      if (size > 0) {
        val top = panelTop + padding
        val destination = RectF(padding, top, padding + size, top + size)
        val corner = size * 0.14f
        val clip = Path().apply { addRoundRect(destination, corner, corner, Path.Direction.CW) }
        canvas.save()
        canvas.clipPath(clip)
        canvas.drawBitmap(mapBitmap, null, destination, Paint(Paint.FILTER_BITMAP_FLAG))
        canvas.restore()
        val framePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
          style = Paint.Style.STROKE
          strokeWidth = max(1f, width * 0.002f)
          color = spec.accentColor
        }
        canvas.drawRoundRect(destination, corner, corner, framePaint)
        contentLeft = padding + size + padding
      }
    }

    // Verified badge / custom logo, top-right corner of the panel
    val firstRowSize = textSize * HEADLINE_SCALE
    val cornerY = panelTop + padding + firstRowSize
    if (logoBitmap != null) {
      val logoHeight = firstRowSize * 1.1f
      val ratio = logoBitmap.width.toFloat() / logoBitmap.height.toFloat()
      val logoWidth = logoHeight * ratio
      val left = contentRight - logoWidth
      val top = panelTop + padding
      canvas.drawBitmap(
        logoBitmap,
        null,
        RectF(left, top, left + logoWidth, top + logoHeight),
        Paint(Paint.FILTER_BITMAP_FLAG),
      )
    } else if (spec.verified) {
      val badgeTextSize = textSize * 0.8f
      val badgePaint = textPaint(spec.accentColor, Typeface.BOLD).apply { textSize = badgeTextSize }
      val badge = "GPS VERIFIED"
      val badgeWidth = badgePaint.measureText(badge)
      canvas.drawText(badge, contentRight - badgeWidth, cornerY, badgePaint)
    }

    // Rows
    var cursorY = panelTop + padding
    var previousEmphasis: String? = null
    var isFirstRow = true
    for (row in layout.rows) {
      val rowSize = sizeFor(row.emphasis, textSize)
      if (isFirstRow) {
        cursorY += rowSize
        isFirstRow = false
      } else {
        cursorY += rowSize * LINE_SPACING
        if (previousEmphasis == "title" && row.emphasis != "title") {
          cursorY += textSize * HEADLINE_GAP_SCALE
        }
      }
      if (cursorY > panelBottom - padding * 0.4f) {
        break
      }
      val paint =
        when (row.emphasis) {
          "title" -> headlinePaint
          "strong" -> strongPaint
          "muted" -> mutedPaint
          else -> bodyPaint
        }
      paint.textSize = rowSize
      var x = contentLeft
      val availableWidth = (if (row.emphasis == "title") contentRight - cornerReserve else contentRight) - contentLeft
      if (row.label != null) {
        labelPaint.textSize = rowSize * 0.85f
        val label = "${row.label}: "
        canvas.drawText(label, x, cursorY, labelPaint)
        x += labelPaint.measureText(label)
      }
      canvas.drawText(ellipsizeIfNeeded(row.text, paint, availableWidth - (x - contentLeft)), x, cursorY, paint)
      previousEmphasis = row.emphasis
    }

    mapBitmap?.recycle()
    logoBitmap?.recycle()

    drawWatermark(canvas, spec, width, height, padding, textSize)

    return target
  }

  /**
   * Small "app brand" chip stamped in the corner opposite the info panel -
   * unobtrusive, but enough to identify what produced the photo. Placed
   * bottom-right when the panel occupies the top, top-right otherwise.
   */
  private fun drawWatermark(
    canvas: Canvas,
    spec: StampSpec,
    width: Float,
    height: Float,
    padding: Float,
    baseTextSize: Float,
  ) {
    val chipTextSize = max(MIN_TEXT_PX * 0.8f, baseTextSize * 0.72f)
    val chipPaint = textPaint(Color.WHITE, Typeface.BOLD).apply { textSize = chipTextSize }
    val text = spec.title
    val textWidth = chipPaint.measureText(text)
    val dotRadius = chipTextSize * 0.28f
    val innerPadding = chipTextSize * 0.55f
    val chipHeight = chipTextSize * 2.1f
    val chipWidth = innerPadding * 2 + dotRadius * 2 + chipTextSize * 0.4f + textWidth

    val margin = padding * 0.8f
    val right = width - margin
    val left = right - chipWidth
    val top = if (spec.position == "top") height - margin - chipHeight else margin
    val bottom = top + chipHeight

    val chipRect = RectF(left, top, right, bottom)
    val chipBg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(168, 8, 10, 14) }
    val chipRadius = chipHeight / 2f
    canvas.drawRoundRect(chipRect, chipRadius, chipRadius, chipBg)

    val dotCx = left + innerPadding + dotRadius
    val dotCy = top + chipHeight / 2f
    val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = spec.accentColor }
    canvas.drawCircle(dotCx, dotCy, dotRadius, dotPaint)

    val textX = dotCx + dotRadius + chipTextSize * 0.4f
    val textY = dotCy - (chipPaint.ascent() + chipPaint.descent()) / 2f
    canvas.drawText(text, textX, textY, chipPaint)
  }

  private fun textPaint(color: Int, style: Int): Paint =
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
      this.color = color
      typeface = Typeface.create(Typeface.SANS_SERIF, style)
    }

  private fun sizeFor(emphasis: String, textSize: Float): Float =
    when (emphasis) {
      "title" -> textSize * HEADLINE_SCALE
      "strong" -> textSize * STRONG_SCALE
      "muted" -> textSize * MUTED_SCALE
      else -> textSize * NORMAL_SCALE
    }

  private data class Row(val label: String?, val text: String, val emphasis: String)

  private data class Layout(val rows: List<Row>, val panelHeight: Float)

  /**
   * Wraps every line to the available column width and returns the exact panel
   * height required, so the background is never taller or shorter than the text.
   * Each row's height is driven by its own emphasis (the headline is much
   * taller than a muted detail row), plus a paragraph gap under the headline.
   */
  private fun layoutRows(
    spec: StampSpec,
    textSize: Float,
    width: Float,
    padding: Float,
    hasMap: Boolean,
    cornerReserve: Float,
    bodyPaint: Paint,
    mutedPaint: Paint,
    strongPaint: Paint,
    headlinePaint: Paint,
  ): Layout {
    val mapReserve = if (hasMap) width * 0.30f else 0f
    val contentLeft = padding + mapReserve
    val available = width - contentLeft - padding

    val rows = mutableListOf<Row>()
    for (line in spec.lines) {
      val rowSize = sizeFor(line.emphasis, textSize)
      val paint =
        when (line.emphasis) {
          "title" -> headlinePaint
          "strong" -> strongPaint
          "muted" -> mutedPaint
          else -> bodyPaint
        }
      paint.textSize = rowSize
      val isFirstRow = rows.isEmpty()
      val reserve = if (line.emphasis == "title" && isFirstRow) cornerReserve else 0f
      val labelWidth = if (line.label != null) paint.measureText("${line.label}: ") else 0f
      val wrapped = wrap(line.value, paint, available - labelWidth - reserve, if (line.emphasis == "title") 2 else 3)
      wrapped.forEachIndexed { index, text ->
        rows.add(Row(if (index == 0) line.label else null, text, line.emphasis))
      }
    }

    var panelHeight = padding * 2f
    var previousEmphasis: String? = null
    var isFirstRow = true
    for (row in rows) {
      val rowSize = sizeFor(row.emphasis, textSize)
      if (isFirstRow) {
        panelHeight += rowSize
        isFirstRow = false
      } else {
        panelHeight += rowSize * LINE_SPACING
        if (previousEmphasis == "title" && row.emphasis != "title") {
          panelHeight += textSize * HEADLINE_GAP_SCALE
        }
      }
      previousEmphasis = row.emphasis
    }
    return Layout(rows, panelHeight)
  }

  private fun wrap(text: String, paint: Paint, maxWidth: Float, maxLines: Int): List<String> {
    if (maxWidth <= 0f || paint.measureText(text) <= maxWidth) {
      return listOf(text)
    }
    val words = text.split(' ')
    val lines = mutableListOf<String>()
    var current = StringBuilder()
    for (word in words) {
      val candidate = if (current.isEmpty()) word else "$current $word"
      if (paint.measureText(candidate) <= maxWidth) {
        current = StringBuilder(candidate)
      } else {
        if (current.isNotEmpty()) {
          lines.add(current.toString())
        }
        current = StringBuilder(word)
      }
    }
    if (current.isNotEmpty()) {
      lines.add(current.toString())
    }
    // Keep the panel bounded even if a single unbreakable token is enormous.
    return if (lines.isEmpty()) listOf(text) else lines.take(maxLines)
  }

  /** Last-resort truncation for a row that still overflows its column after wrapping. */
  private fun ellipsizeIfNeeded(text: String, paint: Paint, maxWidth: Float): String {
    if (maxWidth <= 0f || paint.measureText(text) <= maxWidth) {
      return text
    }
    var end = text.length
    while (end > 0 && paint.measureText(text.substring(0, end) + "…") > maxWidth) {
      end--
    }
    return if (end <= 0) "…" else text.substring(0, end) + "…"
  }

  private fun loadBitmap(path: String): Bitmap? =
    try {
      val file = File(path)
      if (file.exists()) BitmapFactory.decodeFile(path) else null
    } catch (_: Exception) {
      null
    }

  /** Helper kept for future measurement needs (e.g. logo alignment). */
  internal fun measure(paint: Paint, text: String): Rect =
    Rect().also { paint.getTextBounds(text, 0, text.length, it) }
}
